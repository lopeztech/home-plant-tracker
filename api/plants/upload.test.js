import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

// ── JPEG fixtures (real binary files) ─────────────────────────────────────────

const PLANT_JPG     = readFileSync(resolve(__dirname, 'fixtures/plant.jpg'));
const FLOORPLAN_JPG = readFileSync(resolve(__dirname, 'fixtures/floorplan.jpg'));
const PLANT_B64     = PLANT_JPG.toString('base64');
const FLOORPLAN_B64 = FLOORPLAN_JPG.toString('base64');

// ── In-memory Firestore ────────────────────────────────────────────────────────

const store = {};

function makeCollRef(prefix) {
  return {
    doc(id) {
      const path = `${prefix}/${id}`;
      return {
        id,
        get:    async () => ({ exists: store[path] !== undefined, id, data: () => store[path] }),
        set:    async (data, opts) => {
          store[path] = opts?.merge && store[path]
            ? Object.assign({}, store[path], data)
            : Object.assign({}, data);
        },
        collection: sub => makeCollRef(`${path}/${sub}`),
      };
    },
    add: async (data) => {
      const id = `doc-${Object.keys(store).length + 1}`;
      store[`${prefix}/${id}`] = Object.assign({}, data);
      return { id };
    },
    orderBy: () => ({ get: async () => ({ docs: [] }) }),
  };
}

// ── Per-test replaceable mocks ─────────────────────────────────────────────────

let geminiGenerateFn;
let geminiLastCall;       // capture args passed to generateContent
let storageSignedUrlFn;
let storageLastOpts;      // capture opts passed to getSignedUrl

// ── Load app via proxyquire ────────────────────────────────────────────────────

let app;

beforeAll(() => {
  proxyquire('./index', {
    '@google-cloud/functions-framework': {
      http: (_, handler) => { app = handler; },
    },
    '@google/generative-ai': {
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return {
            generateContent(...args) {
              geminiLastCall = args[0];
              return geminiGenerateFn.apply(this, args);
            },
          };
        }
      },
      SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', INTEGER: 'INTEGER' },
    },
    '@google-cloud/storage': {
      Storage: class {
        bucket() {
          return {
            file() {
              return {
                getSignedUrl(opts) {
                  storageLastOpts = opts;
                  return storageSignedUrlFn(opts);
                },
              };
            },
          };
        }
      },
    },
    '@google-cloud/firestore': {
      Firestore: class {
        collection(name) { return makeCollRef(name); }
      },
    },
  });
});

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  geminiLastCall   = null;
  storageLastOpts  = null;
  geminiGenerateFn = async () => { throw new Error('geminiGenerateFn not configured'); };
  storageSignedUrlFn = async () => ['https://storage.googleapis.com/bucket/test.jpg?tok=test'];
});

// ── Auth helper ────────────────────────────────────────────────────────────────

const USER_SUB = 'upload-harness-user';

function authHeader() {
  const p = Buffer.from(JSON.stringify({ sub: USER_SUB })).toString('base64');
  return `Bearer h.${p}.s`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fixture sanity
// ═══════════════════════════════════════════════════════════════════════════════

describe('JPEG fixtures', () => {
  it('plant.jpg starts with JPEG magic bytes FF D8', () => {
    expect(PLANT_JPG[0]).toBe(0xFF);
    expect(PLANT_JPG[1]).toBe(0xD8);
  });

  it('floorplan.jpg starts with JPEG magic bytes FF D8', () => {
    expect(FLOORPLAN_JPG[0]).toBe(0xFF);
    expect(FLOORPLAN_JPG[1]).toBe(0xD8);
  });

  it('plant.jpg ends with JPEG EOI marker FF D9', () => {
    expect(PLANT_JPG[PLANT_JPG.length - 2]).toBe(0xFF);
    expect(PLANT_JPG[PLANT_JPG.length - 1]).toBe(0xD9);
  });

  it('fixtures are non-empty and have a realistic size', () => {
    expect(PLANT_JPG.length).toBeGreaterThan(100);
    expect(FLOORPLAN_JPG.length).toBeGreaterThan(100);
  });

  it('base64-encoding round-trips correctly', () => {
    expect(Buffer.from(PLANT_B64, 'base64')).toEqual(PLANT_JPG);
    expect(Buffer.from(FLOORPLAN_B64, 'base64')).toEqual(FLOORPLAN_JPG);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /images/upload-url
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /images/upload-url', () => {
  const validFilename = 'plants/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';
  const validFloorplan = 'floorplans/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';

  it('returns 400 when filename is missing', async () => {
    const res = await request(app)
      .post('/images/upload-url').set('Authorization', authHeader())
      .send({ contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when contentType is missing', async () => {
    const res = await request(app)
      .post('/images/upload-url').set('Authorization', authHeader())
      .send({ filename: validFilename });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid filename format', async () => {
    const res = await request(app)
      .post('/images/upload-url').set('Authorization', authHeader())
      .send({ filename: '../../../etc/passwd', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid filename/i);
  });

  it('requests a v4 write-action signed URL with correct contentType', async () => {
    storageSignedUrlFn = async (opts) => {
      storageLastOpts = opts;
      return ['https://storage.googleapis.com/bucket/' + validFilename + '?tok=abc'];
    };

    await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({
      filename: validFilename,
      contentType: 'image/jpeg',
    });

    expect(storageLastOpts.version).toBe('v4');
    expect(storageLastOpts.action).toBe('write');
    expect(storageLastOpts.contentType).toBe('image/jpeg');
  });

  it('signed URL expires in approximately 15 minutes', async () => {
    const before = Date.now();
    storageSignedUrlFn = async (opts) => {
      storageLastOpts = opts;
      return ['https://storage.googleapis.com/bucket/' + validFilename + '?tok=x'];
    };
    await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({
      filename: validFilename,
      contentType: 'image/jpeg',
    });
    const after = Date.now();
    expect(storageLastOpts.expires).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
    expect(storageLastOpts.expires).toBeLessThanOrEqual(after  + 16 * 60 * 1000);
  });

  it('returns uploadUrl and a publicUrl containing the filename', async () => {
    storageSignedUrlFn = async () => [
      'https://storage.googleapis.com/bucket/' + validFilename + '?tok=xyz',
    ];
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({
      filename: validFilename,
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toContain('?tok=');
    expect(res.body.publicUrl).toContain(validFilename);
  });

  it('accepts a floorplans/ prefix for floorplan uploads', async () => {
    storageSignedUrlFn = async () => [
      'https://storage.googleapis.com/bucket/' + validFloorplan + '?tok=1',
    ];
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({
      filename: validFloorplan,
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(200);
    expect(res.body.publicUrl).toContain(validFloorplan);
  });

  it('returns 500 when GCS throws', async () => {
    storageSignedUrlFn = async () => { throw new Error('GCS unavailable'); };
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({
      filename: validFilename,
      contentType: 'image/jpeg',
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('GCS unavailable');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /analyse  — plant photo analysis
// ═══════════════════════════════════════════════════════════════════════════════

const ANALYSIS_PAYLOAD = {
  species:         'Nephrolepis exaltata',
  frequencyDays:   7,
  health:          'Good',
  healthReason:    'Vibrant fronds with even colour.',
  maturity:        'Mature',
  recommendations: ['Mist daily', 'Indirect light', 'Repot in spring'],
};

describe('POST /analyse — plant photo analysis with real JPEG', () => {
  it('forwards the JPEG base64 and mimeType to Gemini unchanged', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(ANALYSIS_PAYLOAD) },
    });

    await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    const inlineData = geminiLastCall.contents[0].parts[0].inlineData;
    expect(inlineData.data).toBe(PLANT_B64);
    expect(inlineData.mimeType).toBe('image/jpeg');
  });

  it('decoded base64 matches the source JPEG fixture bytes', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(ANALYSIS_PAYLOAD) },
    });

    await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    const decoded = Buffer.from(
      geminiLastCall.contents[0].parts[0].inlineData.data,
      'base64',
    );
    expect(decoded).toEqual(PLANT_JPG);
  });

  it('returns a complete analysis object for a valid plant JPEG', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(ANALYSIS_PAYLOAD) },
    });

    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.species).toBe('Nephrolepis exaltata');
    expect(res.body.frequencyDays).toBe(7);
    expect(res.body.health).toBe('Good');
    expect(res.body.healthReason).toBeTruthy();
    expect(res.body.recommendations).toHaveLength(3);
    expect(res.body.maturity).toBe('Mature');
  });

  it('returns 500 with "Empty response from AI" when Gemini returns empty text', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => '' } });

    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Empty response from AI');
  });

  it('returns 500 with "Empty response from AI" when Gemini returns only whitespace', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => '   \n  ' } });

    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Empty response from AI');
  });

  it('handles a Gemini response wrapped in markdown code fences', async () => {
    geminiGenerateFn = async () => ({
      response: {
        text: () => '```json\n' + JSON.stringify(ANALYSIS_PAYLOAD) + '\n```',
      },
    });

    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.species).toBe('Nephrolepis exaltata');
  });

  it('handles a Gemini response with raw control characters in string values', async () => {
    const withCtrl = {
      ...ANALYSIS_PAYLOAD,
      healthReason: 'Good\nleaves',   // raw newline inside JSON string
    };
    const raw = JSON.stringify(withCtrl).replace('"Good\\nleaves"', '"Good\nleaves"');
    geminiGenerateFn = async () => ({ response: { text: () => raw } });

    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.healthReason).toBe('Good\nleaves');
  });

  it('returns 400 when imageBase64 is absent', async () => {
    const res = await request(app)
      .post('/analyse')
      .send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is absent', async () => {
    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64 });
    expect(res.status).toBe(400);
  });

  it('returns 500 when Gemini throws (e.g. network / API error)', async () => {
    geminiGenerateFn = async () => { throw new Error('Gemini timeout'); };

    const res = await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Gemini timeout');
  });

  it('forwards the mimeType to Gemini verbatim (supports image/png)', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(ANALYSIS_PAYLOAD) },
    });

    await request(app)
      .post('/analyse')
      .send({ imageBase64: PLANT_B64, mimeType: 'image/png' });

    expect(geminiLastCall.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /analyse-floorplan — floorplan image analysis
// ═══════════════════════════════════════════════════════════════════════════════

const FLOORPLAN_PAYLOAD = {
  floors: [
    {
      name: 'Ground Floor',
      type: 'interior',
      order: 0,
      rooms: [
        { name: 'Living Room', x: 0,  y: 0,  width: 60, height: 50 },
        { name: 'Kitchen',     x: 60, y: 0,  width: 40, height: 50 },
        { name: 'Bathroom',    x: 0,  y: 50, width: 30, height: 50 },
      ],
    },
    {
      name: 'Garden',
      type: 'outdoor',
      order: -1,
      rooms: [],
    },
  ],
};

describe('POST /analyse-floorplan — floorplan JPEG analysis', () => {
  it('forwards the floorplan JPEG base64 and mimeType to Gemini', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(FLOORPLAN_PAYLOAD) },
    });

    await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    const inlineData = geminiLastCall.contents[0].parts[0].inlineData;
    expect(inlineData.data).toBe(FLOORPLAN_B64);
    expect(inlineData.mimeType).toBe('image/jpeg');
  });

  it('decoded base64 matches the source floorplan JPEG fixture bytes', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(FLOORPLAN_PAYLOAD) },
    });

    await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    const decoded = Buffer.from(
      geminiLastCall.contents[0].parts[0].inlineData.data,
      'base64',
    );
    expect(decoded).toEqual(FLOORPLAN_JPG);
  });

  it('returns floors with stable IDs derived from floor names', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(FLOORPLAN_PAYLOAD) },
    });

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    const { floors } = res.body;
    expect(floors).toHaveLength(2);
    expect(floors[0].id).toBe('ground-floor');
    expect(floors[1].id).toBe('garden');
  });

  it('returns complete floor objects with all required fields', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify(FLOORPLAN_PAYLOAD) },
    });

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    const ground = res.body.floors[0];
    expect(ground.name).toBe('Ground Floor');
    expect(ground.type).toBe('interior');
    expect(ground.order).toBe(0);
    expect(ground.imageUrl).toBeNull();
    expect(ground.rooms).toHaveLength(3);
    expect(ground.rooms[0]).toMatchObject({ name: 'Living Room', x: 0, y: 0, width: 60, height: 50 });
  });

  it('returns 500 with "Empty response from AI" when Gemini returns empty text', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => '' } });

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Empty response from AI');
  });

  it('returns 500 when Gemini returns no floors', async () => {
    geminiGenerateFn = async () => ({
      response: { text: () => JSON.stringify({ floors: [] }) },
    });

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/no floors/i);
  });

  it('defaults type to "interior" when Gemini omits the type field', async () => {
    geminiGenerateFn = async () => ({
      response: {
        text: () => JSON.stringify({
          floors: [{ name: 'Level 1', order: 1, rooms: [] }],
        }),
      },
    });

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.floors[0].type).toBe('interior');
  });

  it('defaults order to 0 when Gemini omits the order field', async () => {
    geminiGenerateFn = async () => ({
      response: {
        text: () => JSON.stringify({
          floors: [{ name: 'Main', type: 'interior', rooms: [] }],
        }),
      },
    });

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.floors[0].order).toBe(0);
  });

  it('returns 400 when imageBase64 is missing', async () => {
    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when Gemini throws', async () => {
    geminiGenerateFn = async () => { throw new Error('Gemini API error'); };

    const res = await request(app)
      .post('/analyse-floorplan')
      .send({ imageBase64: FLOORPLAN_B64, mimeType: 'image/jpeg' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Gemini API error');
  });
});
