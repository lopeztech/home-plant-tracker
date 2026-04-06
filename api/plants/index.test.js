import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();

// ── In-memory Firestore store ─────────────────────────────────────────────────

const store = {};
let idCounter = 0;

function clearStore() {
  Object.keys(store).forEach(k => delete store[k]);
  idCounter = 0;
}

function makeCollRef(prefix) {
  return {
    doc(id) {
      const path = `${prefix}/${id}`;
      return {
        id,
        get:    async () => ({ exists: store[path] !== undefined, id, data: () => store[path] }),
        set:    async (data, opts) => {
          store[path] = (opts && opts.merge && store[path])
            ? Object.assign({}, store[path], data)
            : Object.assign({}, data);
        },
        delete: async () => { delete store[path]; },
        collection: sub => makeCollRef(`${path}/${sub}`),
      };
    },
    add: async (data) => {
      const id = `doc-${++idCounter}`;
      store[`${prefix}/${id}`] = Object.assign({}, data);
      return { id };
    },
    get: async () => {
      const pfx = `${prefix}/`;
      const entries = Object.entries(store)
        .filter(([k]) => k.startsWith(pfx) && !k.slice(pfx.length).includes('/'))
        .map(([k, v]) => ({ id: k.slice(pfx.length), data: () => v }));
      return { docs: entries };
    },
    orderBy: (field, dir) => ({
      get: async () => {
        dir = dir || 'asc';
        const pfx = `${prefix}/`;
        const entries = Object.entries(store)
          .filter(([k]) => k.startsWith(pfx) && !k.slice(pfx.length).includes('/'))
          .map(([k, v]) => ({ id: k.slice(pfx.length), data: () => v }));
        entries.sort((a, b) => {
          const av = a.data()[field] != null ? a.data()[field] : '';
          const bv = b.data()[field] != null ? b.data()[field] : '';
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return dir === 'desc' ? -cmp : cmp;
        });
        return { docs: entries.map(e => ({ id: e.id, data: e.data })) };
      },
    }),
  };
}

// ── Per-test replaceable mock functions ───────────────────────────────────────

let geminiGenerateFn;
let storageSignedUrlFn;
let storageDeleteFn;
let storageDeletedPaths;
let vertexaiCheckStatusFn;

// ── Load the express app via proxyquire ───────────────────────────────────────

let app;

beforeAll(() => {
  proxyquire('./index', {
    '@google-cloud/functions-framework': {
      http: (_, handler) => { app = handler; },
    },
    '@google/generative-ai': {
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return { generateContent: function() { return geminiGenerateFn.apply(this, arguments); } };
        }
      },
      SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', INTEGER: 'INTEGER' },
    },
    '@google-cloud/storage': {
      Storage: class {
        bucket(_b) {
          return {
            file: function(f) {
              return {
                getSignedUrl: function() { return storageSignedUrlFn.apply(this, arguments); },
                delete: function() { storageDeletedPaths.push(f); return storageDeleteFn(f); },
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
    './vertexai': {
      checkStatus: function() { return vertexaiCheckStatusFn(); },
      predict: async () => [],
      batchPredict: async () => ({}),
    },
  });
});

beforeEach(() => {
  clearStore();
  geminiGenerateFn = async () => { throw new Error('geminiGenerateFn not configured'); };
  storageSignedUrlFn = async () => ['https://signed.example.com/img.jpg'];
  storageDeleteFn = async () => {};
  storageDeletedPaths = [];
  vertexaiCheckStatusFn = async () => ({ status: 'ok', project: 'test', location: 'us-central1', endpointCount: 0 });
});

// ── Test helpers ──────────────────────────────────────────────────────────────

const USER_SUB = 'user-test-1';

function authHeader(sub) {
  sub = sub || USER_SUB;
  const payload = Buffer.from(JSON.stringify({ sub: sub })).toString('base64');
  return `Bearer h.${payload}.s`;
}

const plantPath = id => `users/${USER_SUB}/plants/${id}`;
const floorsPath = () => `users/${USER_SUB}/config/floors`;

// ── GET /health ───────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('includes security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['x-xss-protection']).toBe('0');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });
});

// ── GET /ml/status ───────────────────────────────────────────────────────────

describe('GET /ml/status', () => {
  it('returns 200 when Vertex AI is reachable', async () => {
    vertexaiCheckStatusFn = async () => ({ status: 'ok', project: 'my-project', location: 'us-central1', endpointCount: 2 });
    const res = await request(app).get('/ml/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.project).toBe('my-project');
  });

  it('returns 503 when Vertex AI is unconfigured', async () => {
    vertexaiCheckStatusFn = async () => ({ status: 'unconfigured', project: null, location: 'us-central1', error: 'VERTEX_AI_PROJECT is not set' });
    const res = await request(app).get('/ml/status');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unconfigured');
  });

  it('returns 502 when Vertex AI returns error status', async () => {
    vertexaiCheckStatusFn = async () => ({ status: 'error', project: 'p', location: 'us-central1', error: 'Network error' });
    const res = await request(app).get('/ml/status');
    expect(res.status).toBe(502);
    expect(res.body.status).toBe('error');
  });

  it('returns 500 when checkStatus throws', async () => {
    vertexaiCheckStatusFn = async () => { throw new Error('unexpected'); };
    const res = await request(app).get('/ml/status');
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});

// ── POST /analyse ─────────────────────────────────────────────────────────────

describe('POST /analyse', () => {
  it('returns 400 when imageBase64 is missing', async () => {
    const res = await request(app).post('/analyse').send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is missing', async () => {
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns parsed Gemini response on success', async () => {
    const payload = { species: 'Nephrolepis exaltata', frequencyDays: 7, health: 'Good', healthReason: 'Vibrant fronds', maturity: 'Mature', recommendations: ['Mist daily', 'Indirect light', 'Repot yearly'] };
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(payload) } });
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc123', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.species).toBe('Nephrolepis exaltata');
    expect(res.body.frequencyDays).toBe(7);
    expect(res.body.health).toBe('Good');
    expect(res.body.recommendations).toHaveLength(3);
  });

  it('parses Gemini response wrapped in markdown code fences', async () => {
    const payload = { species: 'Ficus lyrata', frequencyDays: 10, health: 'Good', healthReason: 'Healthy', maturity: 'Young', recommendations: [] };
    geminiGenerateFn = async () => ({ response: { text: () => '```json\n' + JSON.stringify(payload) + '\n```' } });
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.species).toBe('Ficus lyrata');
  });

  it('parses Gemini response with raw unescaped control characters in string values', async () => {
    // Gemini sometimes emits literal control chars inside string fields instead of escape sequences.
    // \n (newline), \t (tab), and other U+0000-U+001F chars should all be handled.
    const raw = '{"species":"Monstera","frequencyDays":7,"health":"Good","healthReason":"Healthy\nleaves","maturity":"Mat\x08ure","recommendations":[]}';
    geminiGenerateFn = async () => ({ response: { text: () => raw } });
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.healthReason).toBe('Healthy\nleaves');
    expect(res.body.maturity).toBe('Mat\x08ure'); // backspace char round-trips via \u0008
  });

  it('returns 500 if Gemini throws', async () => {
    geminiGenerateFn = async () => { throw new Error('Gemini unavailable'); };
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Gemini unavailable');
  });
});

// ── POST /analyse-floorplan ───────────────────────────────────────────────────

describe('POST /analyse-floorplan', () => {
  it('returns 400 when imageBase64 is missing', async () => {
    const res = await request(app).post('/analyse-floorplan').send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is missing', async () => {
    const res = await request(app).post('/analyse-floorplan').send({ imageBase64: 'abc' });
    expect(res.status).toBe(400);
  });

  it('assigns stable IDs from floor name and returns floors with rooms', async () => {
    geminiGenerateFn = async () => ({
      response: {
        text: () => JSON.stringify({
          floors: [
            { name: 'Ground Floor', type: 'interior', order: 0, rooms: [{ name: 'Kitchen', x: 0, y: 0, width: 50, height: 50 }] },
            { name: 'Garden', type: 'outdoor', order: -1, rooms: [] },
          ],
        }),
      },
    });
    const res = await request(app).post('/analyse-floorplan').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.floors).toHaveLength(2);
    expect(res.body.floors[0].id).toBe('ground-floor');
    expect(res.body.floors[0].rooms[0].name).toBe('Kitchen');
    expect(res.body.floors[1].id).toBe('garden');
    expect(res.body.floors[1].imageUrl).toBeNull();
  });

  it('returns 500 when Gemini returns empty floors array', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify({ floors: [] }) } });
    const res = await request(app).post('/analyse-floorplan').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/no floors/i);
  });
});

// ── POST /recommend ───────────────────────────────────────────────────────────

describe('POST /recommend', () => {
  const carePayload = { summary: 'Easy care fern', watering: 'Weekly', light: 'Indirect', humidity: 'High', soil: 'Well-draining', temperature: '18–24°C', fertilising: 'Monthly', commonIssues: ['Root rot', 'Brown tips'], tips: ['Mist leaves', 'Avoid cold drafts'] };

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/recommend').send({ species: 'Ficus' });
    expect(res.status).toBe(400);
  });

  it('returns care recommendations when name and species are provided', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(carePayload) } });
    const res = await request(app).post('/recommend').send({ name: 'Fern', species: 'Nephrolepis exaltata' });
    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Easy care fern');
    expect(res.body.commonIssues).toHaveLength(2);
    expect(res.body.tips).toHaveLength(2);
  });

  it('works without species', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(carePayload) } });
    const res = await request(app).post('/recommend').send({ name: 'Cactus' });
    expect(res.status).toBe(200);
    expect(res.body.watering).toBeTruthy();
  });
});

// ── POST /images/upload-url ───────────────────────────────────────────────────

describe('POST /images/upload-url', () => {
  const validFilename = 'plants/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg';

  it('returns 401 without auth header', async () => {
    const res = await request(app).post('/images/upload-url').send({ filename: validFilename, contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when filename is missing', async () => {
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({ contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when contentType is missing', async () => {
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader()).send({ filename: validFilename });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid filename format', async () => {
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader())
      .send({ filename: '../../../etc/passwd', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid filename/i);
  });

  it('returns 400 for filename without allowed prefix', async () => {
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader())
      .send({ filename: 'arbitrary/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns uploadUrl and publicUrl', async () => {
    storageSignedUrlFn = async () => ['https://storage.googleapis.com/bucket/' + validFilename + '?token=xyz'];
    const res = await request(app).post('/images/upload-url').set('Authorization', authHeader())
      .send({ filename: validFilename, contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toContain('?token=');
    expect(res.body.publicUrl).toContain(validFilename);
  });
});

// ── requireUser middleware ─────────────────────────────────────────────────────

describe('requireUser middleware', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/plants');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token payload has no sub', async () => {
    const payload = Buffer.from(JSON.stringify({ email: 'nobody@example.com' })).toString('base64');
    const res = await request(app).get('/plants').set('Authorization', `Bearer h.${payload}.s`);
    expect(res.status).toBe(401);
  });

  it('passes with a valid sub in the Bearer token', async () => {
    const res = await request(app).get('/plants').set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });
});

// ── GET /config/floors ────────────────────────────────────────────────────────

describe('GET /config/floors', () => {
  it('falls back to DEFAULT_FLOORS when no config is saved', async () => {
    const res = await request(app).get('/config/floors').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.floors)).toBe(true);
    expect(res.body.floors.length).toBeGreaterThanOrEqual(2);
    expect(res.body.floors.every(f => f.imageUrl === null)).toBe(true);
  });

  it('returns saved floors from Firestore', async () => {
    store[floorsPath()] = { floors: [{ id: 'lvl1', name: 'Level 1', type: 'interior', order: 0, imageUrl: null }] };
    const res = await request(app).get('/config/floors').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.floors[0].id).toBe('lvl1');
  });

  it('signs imageUrl when a floor has one', async () => {
    store[floorsPath()] = { floors: [{ id: 'f1', name: 'F1', type: 'interior', order: 0, imageUrl: 'floors/f1.jpg' }] };
    storageSignedUrlFn = async () => ['https://signed.url/floor.jpg'];
    const res = await request(app).get('/config/floors').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.floors[0].imageUrl).toBe('https://signed.url/floor.jpg');
  });
});

// ── PUT /config/floors ────────────────────────────────────────────────────────

describe('PUT /config/floors', () => {
  it('saves floors and returns them', async () => {
    const floors = [{ id: 'g', name: 'Ground', type: 'interior', order: 0, imageUrl: null }];
    const res = await request(app).put('/config/floors').set('Authorization', authHeader()).send({ floors });
    expect(res.status).toBe(200);
    expect(res.body.floors[0].id).toBe('g');
  });

  it('persists the floors to the Firestore store', async () => {
    const floors = [{ id: 'up', name: 'Upstairs', type: 'interior', order: 1, imageUrl: null }];
    await request(app).put('/config/floors').set('Authorization', authHeader()).send({ floors });
    expect(store[floorsPath()].floors[0].id).toBe('up');
  });
});

// ── GET /plants ───────────────────────────────────────────────────────────────

describe('GET /plants', () => {
  it('returns an empty array when there are no plants', async () => {
    const res = await request(app).get('/plants').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns plants sorted by createdAt descending', async () => {
    store[plantPath('p1')] = { name: 'Fern',   createdAt: '2026-01-01T00:00:00.000Z' };
    store[plantPath('p2')] = { name: 'Cactus', createdAt: '2026-03-01T00:00:00.000Z' };
    const res = await request(app).get('/plants').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Cactus');
    expect(res.body[1].name).toBe('Fern');
  });

  it('includes the document id in each plant', async () => {
    store[plantPath('abc')] = { name: 'Rose', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app).get('/plants').set('Authorization', authHeader());
    expect(res.body[0].id).toBe('abc');
  });

  it('signs imageUrl for plants that have one', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z', imageUrl: 'plants/fern.jpg' };
    storageSignedUrlFn = async () => ['https://signed.url/fern.jpg'];
    const res = await request(app).get('/plants').set('Authorization', authHeader());
    expect(res.body[0].imageUrl).toBe('https://signed.url/fern.jpg');
  });
});

// ── POST /plants ──────────────────────────────────────────────────────────────

describe('POST /plants', () => {
  it('creates a plant and returns 201 with timestamps', async () => {
    const res = await request(app)
      .post('/plants').set('Authorization', authHeader())
      .send({ name: 'Monstera', floor: 'ground', x: 50, y: 50 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Monstera');
    expect(res.body.id).toBeTruthy();
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
  });

  it('strips imageBase64 from the stored document', async () => {
    const res = await request(app)
      .post('/plants').set('Authorization', authHeader())
      .send({ name: 'Fern', imageBase64: 'giant-string', floor: 'ground', x: 10, y: 10 });
    expect(res.status).toBe(201);
    expect(res.body.imageBase64).toBeUndefined();
    expect(store[plantPath(res.body.id)].imageBase64).toBeUndefined();
  });

  it('stores sunExposure and sunHoursPerDay fields', async () => {
    const res = await request(app)
      .post('/plants').set('Authorization', authHeader())
      .send({ name: 'Cactus', floor: 'ground', x: 50, y: 50, sunExposure: 'full-sun', sunHoursPerDay: 8 });
    expect(res.status).toBe(201);
    expect(res.body.sunExposure).toBe('full-sun');
    expect(res.body.sunHoursPerDay).toBe(8);
    expect(store[plantPath(res.body.id)].sunExposure).toBe('full-sun');
    expect(store[plantPath(res.body.id)].sunHoursPerDay).toBe(8);
  });
});

// ── GET /plants/:id ───────────────────────────────────────────────────────────

describe('GET /plants/:id', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app).get('/plants/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns the plant with its id', async () => {
    store[plantPath('p1')] = { name: 'Fern', floor: 'ground' };
    const res = await request(app).get('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('p1');
    expect(res.body.name).toBe('Fern');
  });

  it('signs imageUrl when plant has one', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'plants/fern.jpg' };
    storageSignedUrlFn = async () => ['https://signed.url/fern-get.jpg'];
    const res = await request(app).get('/plants/p1').set('Authorization', authHeader());
    expect(res.body.imageUrl).toBe('https://signed.url/fern-get.jpg');
  });
});

// ── PUT /plants/:id ───────────────────────────────────────────────────────────

describe('PUT /plants/:id', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app)
      .put('/plants/missing').set('Authorization', authHeader())
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates the plant and sets updatedAt', async () => {
    const original = '2026-01-01T00:00:00.000Z';
    store[plantPath('p1')] = { name: 'Fern', createdAt: original, updatedAt: original };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Updated Fern', frequencyDays: 10 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Fern');
    expect(res.body.frequencyDays).toBe(10);
    expect(res.body.updatedAt).not.toBe(original);
  });

  it('strips imageBase64 from the update', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Fern', imageBase64: 'huge-data' });
    expect(store[plantPath('p1')].imageBase64).toBeUndefined();
  });

  it('updates sunExposure and sunHoursPerDay via PUT', async () => {
    store[plantPath('p1')] = { name: 'Cactus', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ sunExposure: 'shade', sunHoursPerDay: 2 });
    expect(res.status).toBe(200);
    expect(res.body.sunExposure).toBe('shade');
    expect(res.body.sunHoursPerDay).toBe(2);
  });

  it('uses merge semantics — preserves untouched fields', async () => {
    store[plantPath('p1')] = { name: 'Fern', species: 'Nephrolepis', floor: 'ground', createdAt: '2026-01-01T00:00:00.000Z' };
    await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Fern Updated' });
    expect(store[plantPath('p1')].species).toBe('Nephrolepis');
  });
});

// ── POST /plants/:id/water ────────────────────────────────────────────────────

describe('POST /plants/:id/water', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app).post('/plants/missing/water').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('appends to an existing wateringLog and updates lastWatered', async () => {
    store[plantPath('p1')] = { name: 'Fern', wateringLog: [{ date: '2026-01-01T00:00:00.000Z', note: '' }] };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.wateringLog).toHaveLength(2);
    expect(res.body.lastWatered).toBeTruthy();
  });

  it('creates wateringLog from scratch when none exists', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.wateringLog).toHaveLength(1);
    expect(res.body.wateringLog[0].note).toBe('');
  });

  it('signs imageUrl in the response when plant has an image', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'plants/fern.jpg' };
    storageSignedUrlFn = async () => ['https://signed.url/fern-water.jpg'];
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader());
    expect(res.body.imageUrl).toBe('https://signed.url/fern-water.jpg');
  });
});

// ── DELETE /plants/:id ────────────────────────────────────────────────────────

describe('DELETE /plants/:id', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app).delete('/plants/missing').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('deletes the plant and returns 204', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
  });

  it('removes the document from Firestore', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(store[plantPath('p1')]).toBeUndefined();
  });

  it('deletes the GCS image when the plant has an imageUrl', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/fern.jpg' };
    const res = await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(storageDeletedPaths).toContain('plants/fern.jpg');
  });

  it('does not attempt GCS delete when plant has no imageUrl', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(storageDeletedPaths).toHaveLength(0);
  });

  it('still deletes the plant even if GCS delete fails', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/fern.jpg' };
    storageDeleteFn = async () => { throw new Error('GCS error'); };
    const res = await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(store[plantPath('p1')]).toBeUndefined();
  });
});

// ── PUT /plants/:id — GCS image cleanup on replacement ──────────────────────

describe('PUT /plants/:id — image replacement', () => {
  it('deletes old GCS image when imageUrl changes', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/old.jpg', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/new.jpg' });
    expect(res.status).toBe(200);
    expect(storageDeletedPaths).toContain('plants/old.jpg');
  });

  it('does not delete GCS image when imageUrl stays the same', async () => {
    const url = 'https://storage.googleapis.com/undefined/plants/same.jpg';
    store[plantPath('p1')] = { name: 'Fern', imageUrl: url, createdAt: '2026-01-01T00:00:00.000Z' };
    await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Updated Fern', imageUrl: url });
    expect(storageDeletedPaths).toHaveLength(0);
  });

  it('does not delete GCS image when update has no imageUrl field', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/keep.jpg', createdAt: '2026-01-01T00:00:00.000Z' };
    await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Updated Fern' });
    expect(storageDeletedPaths).toHaveLength(0);
  });

  it('still updates the plant even if old image GCS delete fails', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/old.jpg', createdAt: '2026-01-01T00:00:00.000Z' };
    storageDeleteFn = async () => { throw new Error('GCS error'); };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Updated Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/new.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Fern');
  });
});

// ── PUT /plants/:id — health log tracking ────────────────────────────────────

describe('PUT /plants/:id — health log', () => {
  it('appends to healthLog when health changes', async () => {
    store[plantPath('p1')] = { name: 'Fern', health: 'Good', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ health: 'Poor', healthReason: 'Wilting leaves' });
    expect(res.status).toBe(200);
    expect(res.body.healthLog).toHaveLength(1);
    expect(res.body.healthLog[0].health).toBe('Poor');
    expect(res.body.healthLog[0].reason).toBe('Wilting leaves');
  });

  it('does not append to healthLog when health stays the same', async () => {
    store[plantPath('p1')] = { name: 'Fern', health: 'Good', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ health: 'Good' });
    expect(res.status).toBe(200);
    expect(res.body.healthLog).toBeUndefined();
  });

  it('accumulates multiple health changes in healthLog', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', health: 'Good', createdAt: '2026-01-01T00:00:00.000Z',
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Good', reason: '' }],
    };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ health: 'Fair', healthReason: 'Yellowing' });
    expect(res.status).toBe(200);
    expect(res.body.healthLog).toHaveLength(2);
    expect(res.body.healthLog[1].health).toBe('Fair');
  });

  it('defaults healthReason to empty string when not provided', async () => {
    store[plantPath('p1')] = { name: 'Fern', health: 'Good', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ health: 'Excellent' });
    expect(res.body.healthLog[0].reason).toBe('');
  });
});

// ── GET /plants/:id/watering-pattern ─────────────────────────────────────────

describe('GET /plants/:id/watering-pattern', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns insufficient_data when wateringLog has fewer than 3 entries', async () => {
    store[plantPath('p1')] = { name: 'Fern', wateringLog: [{ date: '2026-01-01T00:00:00.000Z' }] };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pattern).toBe('insufficient_data');
    expect(res.body.confidence).toBe(0);
  });

  it('returns insufficient_data when wateringLog is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.body.pattern).toBe('insufficient_data');
  });

  it('returns optimal when watering matches recommended frequency', async () => {
    const base = new Date('2026-01-01');
    const wateringLog = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(base.getTime() + i * 7 * 86400000).toISOString(),
    }));
    store[plantPath('p1')] = { name: 'Fern', frequencyDays: 7, wateringLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pattern).toBe('optimal');
    expect(res.body.confidence).toBeGreaterThan(0.5);
  });

  it('returns over_watered when watering far more often than recommended', async () => {
    const base = new Date('2026-01-01');
    // Water every 2 days but recommended is 14 days (adherence = 2/14 = 0.14)
    const wateringLog = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(base.getTime() + i * 2 * 86400000).toISOString(),
    }));
    store[plantPath('p1')] = { name: 'Cactus', frequencyDays: 14, wateringLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.body.pattern).toBe('over_watered');
  });

  it('returns under_watered when watering far less often than recommended', async () => {
    const base = new Date('2026-01-01');
    // Water every 21 days but recommended is 7 (adherence = 21/7 = 3.0)
    const wateringLog = Array.from({ length: 4 }, (_, i) => ({
      date: new Date(base.getTime() + i * 21 * 86400000).toISOString(),
    }));
    store[plantPath('p1')] = { name: 'Fern', frequencyDays: 7, wateringLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.body.pattern).toBe('under_watered');
  });

  it('returns inconsistent when watering gaps vary wildly', async () => {
    const wateringLog = [
      { date: '2026-01-01T00:00:00.000Z' },
      { date: '2026-01-02T00:00:00.000Z' },  // 1 day gap
      { date: '2026-01-22T00:00:00.000Z' },  // 20 day gap
      { date: '2026-01-23T00:00:00.000Z' },  // 1 day gap
    ];
    store[plantPath('p1')] = { name: 'Fern', frequencyDays: 7, wateringLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.body.pattern).toBe('inconsistent');
  });

  it('increases over_watered confidence when health has declined', async () => {
    const base = new Date('2026-01-01');
    const wateringLog = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(base.getTime() + i * 2 * 86400000).toISOString(),
    }));
    const healthLog = [
      { date: '2026-01-01T00:00:00.000Z', health: 'Excellent' },
      { date: '2026-01-10T00:00:00.000Z', health: 'Poor' },
    ];
    store[plantPath('p1')] = { name: 'Fern', frequencyDays: 14, wateringLog, healthLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.body.pattern).toBe('over_watered');
    expect(res.body.confidence).toBeGreaterThan(0.5);
    expect(res.body.contributingFactors.some(f => f.includes('Health'))).toBe(true);
  });

  it('returns contributingFactors array with at least one entry', async () => {
    const base = new Date('2026-01-01');
    const wateringLog = Array.from({ length: 4 }, (_, i) => ({
      date: new Date(base.getTime() + i * 7 * 86400000).toISOString(),
    }));
    store[plantPath('p1')] = { name: 'Fern', frequencyDays: 7, wateringLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(Array.isArray(res.body.contributingFactors)).toBe(true);
    expect(res.body.contributingFactors.length).toBeGreaterThanOrEqual(1);
  });
});

// ── requireUser — x-apigateway-api-userinfo header ───────────────────────────

describe('requireUser — API Gateway auth path', () => {
  it('authenticates via x-apigateway-api-userinfo header', async () => {
    const payload = Buffer.from(JSON.stringify({ sub: USER_SUB })).toString('base64');
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .get('/plants')
      .set('x-apigateway-api-userinfo', payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('falls back to Bearer token when x-apigateway-api-userinfo has no sub', async () => {
    const gatewayPayload = Buffer.from(JSON.stringify({ email: 'no-sub@example.com' })).toString('base64');
    const res = await request(app)
      .get('/plants')
      .set('x-apigateway-api-userinfo', gatewayPayload)
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });
});

// ── Under-watered + health decline branch ────────────────────────────────────

describe('GET /plants/:id/watering-pattern — under_watered with health decline', () => {
  it('detects under_watered with health decline and boosts confidence', async () => {
    const base = new Date('2026-01-01');
    // Water every 14 days but recommended is 5 (adherence = 14/5 = 2.8 > 1.5)
    const wateringLog = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(base.getTime() + i * 14 * 86400000).toISOString(),
    }));
    const healthLog = [
      { date: '2026-01-01T00:00:00.000Z', health: 'Good' },
      { date: '2026-02-15T00:00:00.000Z', health: 'Poor' },
    ];
    store[plantPath('p1')] = { name: 'Fern', frequencyDays: 5, wateringLog, healthLog };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.body.pattern).toBe('under_watered');
    expect(res.body.confidence).toBeGreaterThan(0.5);
    expect(res.body.contributingFactors.some(f => f.includes('Health'))).toBe(true);
    expect(res.body.contributingFactors.some(f => f.includes('vs recommended'))).toBe(true);
  });
});

// ── Gemini retry logic ───────────────────────────────────────────────────────

describe('POST /analyse — Gemini retry logic', () => {
  it('retries on failure and succeeds on second attempt', async () => {
    let callCount = 0;
    const payload = { species: 'Ficus', frequencyDays: 7, health: 'Good', healthReason: 'OK', maturity: 'Mature', recommendations: [] };
    geminiGenerateFn = async () => {
      callCount++;
      if (callCount === 1) throw new Error('Transient failure');
      return { response: { text: () => JSON.stringify(payload) } };
    };
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.species).toBe('Ficus');
    expect(callCount).toBe(2);
  });

  it('exhausts all retries and returns 500', async () => {
    geminiGenerateFn = async () => { throw new Error('Persistent failure'); };
    const res = await request(app).post('/analyse').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Persistent failure');
  });
});

// ── Legacy floorplan endpoints ───────────────────────────────────────────────

const floorplanPath = () => `users/${USER_SUB}/config/floorplan`;

describe('GET /config/floorplan', () => {
  it('returns { imageUrl: null } when no config exists', async () => {
    const res = await request(app).get('/config/floorplan').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBeNull();
  });

  it('returns saved floorplan config with signed imageUrl', async () => {
    store[floorplanPath()] = { imageUrl: 'floorplans/plan.jpg' };
    storageSignedUrlFn = async () => ['https://signed.url/plan.jpg'];
    const res = await request(app).get('/config/floorplan').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe('https://signed.url/plan.jpg');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/config/floorplan');
    expect(res.status).toBe(401);
  });
});

describe('PUT /config/floorplan', () => {
  it('saves floorplan config and returns signed imageUrl', async () => {
    storageSignedUrlFn = async () => ['https://signed.url/new-plan.jpg'];
    const res = await request(app).put('/config/floorplan').set('Authorization', authHeader())
      .send({ imageUrl: 'floorplans/new-plan.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe('https://signed.url/new-plan.jpg');
  });

  it('persists the config to Firestore with merge semantics', async () => {
    store[floorplanPath()] = { imageUrl: 'floorplans/old.jpg', customField: 'keep' };
    await request(app).put('/config/floorplan').set('Authorization', authHeader())
      .send({ imageUrl: 'floorplans/new.jpg' });
    expect(store[floorplanPath()].imageUrl).toBe('floorplans/new.jpg');
    expect(store[floorplanPath()].updatedAt).toBeTruthy();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).put('/config/floorplan').send({ imageUrl: 'test.jpg' });
    expect(res.status).toBe(401);
  });
});

// ── ML export endpoint ───────────────────────────────────────────────────────

describe('GET /ml/export', () => {
  it('returns 403 without admin token', async () => {
    const res = await request(app).get('/ml/export');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('returns 403 with wrong admin token', async () => {
    process.env.ML_ADMIN_TOKEN = 'correct-token';
    const res = await request(app).get('/ml/export').set('x-admin-token', 'wrong-token');
    expect(res.status).toBe(403);
    delete process.env.ML_ADMIN_TOKEN;
  });

  it('returns NDJSON feature rows for plants with sufficient watering data', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    // Seed a user with a plant that has watering log
    store['users/user-ml-1'] = { email: 'test@example.com' };
    store['users/user-ml-1/plants/p1'] = {
      name: 'Fern',
      species: 'Nephrolepis',
      frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
      healthLog: [
        { date: '2026-01-01T00:00:00.000Z', health: 'Good' },
      ],
    };
    const res = await request(app).get('/ml/export').set('x-admin-token', 'test-token');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.headers['content-disposition']).toContain('features-');
    const lines = res.text.trim().split('\n').map(l => JSON.parse(l));
    expect(lines.length).toBe(2); // 3 watering events → 2 feature rows
    expect(lines[0].species).toBe('Nephrolepis');
    expect(lines[0].days_between_waterings).toBe(7);
    expect(lines[0].recommended_frequency).toBe(7);
    delete process.env.ML_ADMIN_TOKEN;
  });

  it('returns empty body when no users or plants exist', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    const res = await request(app).get('/ml/export').set('x-admin-token', 'test-token');
    expect(res.status).toBe(200);
    expect(res.text).toBe('');
    delete process.env.ML_ADMIN_TOKEN;
  });
});

// ── gcsPath edge cases ───────────────────────────────────────────────────────

describe('gcsPath — via DELETE /plants/:id', () => {
  it('handles imageUrl that is already a plain path (no URL prefix)', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'plants/fern.jpg' };
    const res = await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(storageDeletedPaths).toContain('plants/fern.jpg');
  });

  it('handles imageUrl that is a full GCS URL', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/fern.jpg' };
    const res = await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(storageDeletedPaths).toContain('plants/fern.jpg');
  });

  it('does not attempt delete when imageUrl is null', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: null };
    const res = await request(app).delete('/plants/p1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(storageDeletedPaths).toHaveLength(0);
  });
});
