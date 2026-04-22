import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();
const { jsonrepair: realJsonrepair } = require('jsonrepair');

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
let storageSavedFiles;
let vertexaiCheckStatusFn;
let vertexaiPredictFn;
let jsonrepairFn;

// ── Load the express app via proxyquire ───────────────────────────────────────

let app;

beforeAll(() => {
  proxyquire('./index', {
    'express-rate-limit': () => (_req, _res, next) => next(),
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
                save: function(content, opts) { storageSavedFiles.push({ path: f, content, opts }); return Promise.resolve(); },
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
      predict: function() { return vertexaiPredictFn.apply(this, arguments); },
      batchPredict: async () => ({}),
    },
    'jsonrepair': {
      jsonrepair: function(s) { return jsonrepairFn(s); },
    },
    'express-rate-limit': () => (_req, _res, next) => next(),
  });
});

beforeEach(() => {
  clearStore();
  geminiGenerateFn = async () => { throw new Error('geminiGenerateFn not configured'); };
  storageSignedUrlFn = async () => ['https://signed.example.com/img.jpg'];
  storageDeleteFn = async () => {};
  storageDeletedPaths = [];
  storageSavedFiles = [];
  vertexaiCheckStatusFn = async () => ({ status: 'ok', project: 'test', location: 'us-central1', endpointCount: 0 });
  vertexaiPredictFn = async () => [];
  // Default to the real implementation so existing tests that exercise the
  // repair fallback behave unchanged; individual tests can override.
  jsonrepairFn = realJsonrepair;
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

  it('accepts plantedIn and isOutdoor context', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(carePayload) } });
    const res = await request(app).post('/recommend').send({ name: 'Rose', species: 'Rosa', plantedIn: 'ground', isOutdoor: true });
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeTruthy();
  });

  it('returns a friendly error when Gemini output is unparseable', async () => {
    // Force JSON.parse to fail at every stage so the jsonrepair fallback runs,
    // then make jsonrepair throw the style of error the user reported.
    geminiGenerateFn = async () => ({ response: { text: () => '{"summary": not-valid}' } });
    jsonrepairFn = () => { throw new Error('Object key expected at position 14.'); };
    const res = await request(app).post('/recommend').send({ name: 'Mystery', species: 'Unknown' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unexpected response|try again/i);
    // No raw jsonrepair jargon leaking out.
    expect(res.body.error).not.toMatch(/position \d+/i);
    expect(res.body.error).not.toMatch(/object key/i);
  });

  it('threads location and temp unit into the prompt and bans USDA zones', async () => {
    let capturedPrompt = null;
    geminiGenerateFn = async (req) => {
      capturedPrompt = req.contents[0].parts[0].text;
      return { response: { text: () => JSON.stringify(carePayload) } };
    };
    const res = await request(app).post('/recommend').send({
      name: 'Anthurium', species: 'Anthurium andraeanum',
      location: { name: 'Sydney', country: 'Australia' },
      tempUnit: 'C',
    });
    expect(res.status).toBe(200);
    expect(capturedPrompt).toMatch(/Sydney, Australia/);
    expect(capturedPrompt).toMatch(/°C/);
    expect(capturedPrompt).toMatch(/USDA/);
    expect(capturedPrompt).toMatch(/DO NOT reference USDA/);
  });

  it('honours Fahrenheit when the user prefers it', async () => {
    let capturedPrompt = null;
    geminiGenerateFn = async (req) => {
      capturedPrompt = req.contents[0].parts[0].text;
      return { response: { text: () => JSON.stringify(carePayload) } };
    };
    const res = await request(app).post('/recommend').send({
      name: 'Rose', species: 'Rosa', tempUnit: 'F',
    });
    expect(res.status).toBe(200);
    expect(capturedPrompt).toMatch(/°F/);
    expect(capturedPrompt).not.toMatch(/in °C/);
  });

  it('returns a friendly error when Gemini truncates the response at MAX_TOKENS', async () => {
    geminiGenerateFn = async () => ({
      response: {
        text: () => '{"summary":"Anthuriums thrive in warm, humid climates with bright, indirect light. Ensure well-draining, rich soil and consistent moisture for',
        candidates: [{ finishReason: 'MAX_TOKENS' }],
      },
    });
    const res = await request(app).post('/recommend').send({ name: 'Anthurium', species: 'Anthurium' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/cut off|too long/i);
  });
});

// ── POST /recommend-watering ──────────────────────────────────────────────────

describe('POST /recommend-watering', () => {
  const wateringPayload = { amount: '500ml', frequency: 'Every 3-5 days', recommendedFrequencyDays: 4, method: 'Deep soak', seasonalTips: 'Reduce in winter', signs: 'Yellow leaves = overwatering', summary: 'Water deeply but infrequently.' };

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/recommend-watering').send({ species: 'Ficus' });
    expect(res.status).toBe(400);
  });

  it('returns watering recommendations with full context', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(wateringPayload) } });
    const res = await request(app).post('/recommend-watering').send({
      name: 'Fern', species: 'Nephrolepis', plantedIn: 'pot', isOutdoor: false,
      potSize: 'medium', soilType: 'well-draining', sunExposure: 'part-sun', health: 'Good', season: 'spring',
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe('500ml');
    expect(res.body.frequency).toBeTruthy();
    expect(res.body.method).toBeTruthy();
    expect(res.body.signs).toBeTruthy();
    expect(res.body.summary).toBeTruthy();
  });

  it('works with name only', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(wateringPayload) } });
    const res = await request(app).post('/recommend-watering').send({ name: 'Cactus' });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBeTruthy();
  });

  it('threads location and Fahrenheit unit into the watering prompt', async () => {
    let capturedPrompt = null;
    geminiGenerateFn = async (req) => {
      capturedPrompt = req.contents[0].parts[0].text;
      return { response: { text: () => JSON.stringify(wateringPayload) } };
    };
    const res = await request(app).post('/recommend-watering').send({
      name: 'Anthurium', species: 'Anthurium',
      location: { name: 'Sydney', country: 'Australia' },
      tempUnit: 'F', temperature: 77,
    });
    expect(res.status).toBe(200);
    expect(capturedPrompt).toMatch(/Sydney, Australia/);
    expect(capturedPrompt).toMatch(/current temperature: 77°F/);
    expect(capturedPrompt).toMatch(/USDA/);
  });

  it('returns recommendedFrequencyDays', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(wateringPayload) } });
    const res = await request(app).post('/recommend-watering').send({
      name: 'Fern', plantedIn: 'pot', potMaterial: 'terracotta', temperature: 25,
    });
    expect(res.status).toBe(200);
    expect(res.body.recommendedFrequencyDays).toBe(4);
  });
});

// ── POST /plants/recalculate-frequencies ──────────────────────────────────────

describe('POST /plants/recalculate-frequencies', () => {
  const wateringPayload = { amount: '300ml', frequency: 'Every 5 days', recommendedFrequencyDays: 5, method: 'Top water', seasonalTips: 'Less in winter', signs: 'Wilting', summary: 'Water every 5 days.' };

  it('returns 401 without auth header', async () => {
    const res = await request(app).post('/plants/recalculate-frequencies').send({});
    expect(res.status).toBe(401);
  });

  it('returns updated count for existing plants', async () => {
    // Create a test plant first
    await request(app).post('/plants').set('Authorization', authHeader()).send({ name: 'Test Fern', species: 'Nephrolepis', frequencyDays: 7 });
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(wateringPayload) } });
    const res = await request(app).post('/plants/recalculate-frequencies').set('Authorization', authHeader()).send({ season: 'autumn', temperature: 22 });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);
    expect(res.body.results.some((r) => r.newFrequency === 5)).toBe(true);
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

  it('returns 201 even when image signing fails after save', async () => {
    storageSignedUrlFn = async () => { throw new Error('signing unavailable'); };
    const res = await request(app)
      .post('/plants').set('Authorization', authHeader())
      .send({ name: 'Bulk Plant', imageUrl: 'https://storage.googleapis.com/bucket/plants/abc.jpg', floor: 'ground', x: 50, y: 50 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('Bulk Plant');
    // Plant should be stored in Firestore despite signing failure
    expect(store[plantPath(res.body.id)].name).toBe('Bulk Plant');
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

  it('stores rich metadata fields when provided', async () => {
    store[plantPath('p1')] = { name: 'Monstera', wateringLog: [] };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader())
      .send({ volumeMl: 350, method: 'top', soilBefore: 'dry', drainedCleanly: true });
    expect(res.status).toBe(200);
    const entry = res.body.wateringLog[0];
    expect(entry.volumeMl).toBe(350);
    expect(entry.method).toBe('top');
    expect(entry.soilBefore).toBe('dry');
    expect(entry.drainedCleanly).toBe(true);
    expect(entry.amount).toBe('350ml');
  });

  it('returns 400 for invalid method value', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader())
      .send({ method: 'bucket' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('method');
  });

  it('returns 400 for invalid soilBefore value', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader())
      .send({ soilBefore: 'unknown' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('soilBefore');
  });

  it('accepts legacy shape (amount + method) without error', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader())
      .send({ amount: '250ml', method: 'top' });
    expect(res.status).toBe(200);
    expect(res.body.wateringLog[0].amount).toBe('250ml');
  });
});

// ── GET /plants/:id/waterings ────────────────────────────────────────────────

describe('GET /plants/:id/waterings', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/waterings').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns waterings sorted newest first', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z', volumeMl: 100, method: 'top' },
        { date: '2026-01-10T00:00:00.000Z', volumeMl: 200, method: 'bottom' },
      ],
    };
    const res = await request(app).get('/plants/p1/waterings').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.waterings).toHaveLength(2);
    expect(res.body.waterings[0].date).toBe('2026-01-10T00:00:00.000Z');
    expect(res.body.total).toBe(2);
  });

  it('returns empty waterings for plant with no log', async () => {
    store[plantPath('p1')] = { name: 'Cactus' };
    const res = await request(app).get('/plants/p1/waterings').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.waterings).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('respects limit query parameter', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      wateringLog: Array.from({ length: 10 }, (_, i) => ({
        date: new Date(2026, 0, i + 1).toISOString(), volumeMl: 100,
      })),
    };
    const res = await request(app).get('/plants/p1/waterings?limit=3').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.waterings).toHaveLength(3);
    expect(res.body.total).toBe(10);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/plants/p1/waterings');
    expect(res.status).toBe(401);
  });
});

// ── POST /plants/:id/moisture ─────────────────────────────────────────────────

describe('POST /plants/:id/moisture', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app).post('/plants/missing/moisture').set('Authorization', authHeader()).send({ reading: 5 });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid reading (too low)', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({ reading: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('between 1 and 10');
  });

  it('returns 400 for invalid reading (too high)', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({ reading: 11 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer reading', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({ reading: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing reading', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(400);
  });

  it('appends to moistureLog and sets convenience fields', async () => {
    store[plantPath('p1')] = { name: 'Fern', moistureLog: [{ date: '2026-01-01T00:00:00Z', reading: 5, note: '' }] };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({ reading: 3, note: 'Dry topsoil' });
    expect(res.status).toBe(200);
    expect(res.body.moistureLog).toHaveLength(2);
    expect(res.body.moistureLog[1].reading).toBe(3);
    expect(res.body.moistureLog[1].note).toBe('Dry topsoil');
    expect(res.body.lastMoistureReading).toBe(3);
    expect(res.body.lastMoistureDate).toBeTruthy();
  });

  it('creates moistureLog from scratch when none exists', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({ reading: 7 });
    expect(res.status).toBe(200);
    expect(res.body.moistureLog).toHaveLength(1);
    expect(res.body.moistureLog[0].reading).toBe(7);
    expect(res.body.moistureLog[0].note).toBe('');
  });

  it('invalidates relevant ML caches', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      mlCache: { wateringRecommendation: { ts: 1 }, healthPrediction: { ts: 1 }, wateringPattern: { ts: 1 } },
    };
    const res = await request(app).post('/plants/p1/moisture').set('Authorization', authHeader()).send({ reading: 5 });
    expect(res.status).toBe(200);
    expect(res.body.mlCache.wateringRecommendation).toBeUndefined();
    expect(res.body.mlCache.healthPrediction).toBeUndefined();
    // wateringPattern is NOT invalidated by moisture
    expect(res.body.mlCache.wateringPattern).toBeDefined();
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
  it('preserves old image in photoLog when imageUrl changes', async () => {
    const oldUrl = 'https://storage.googleapis.com/undefined/plants/old.jpg';
    store[plantPath('p1')] = { name: 'Fern', imageUrl: oldUrl, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Fern', imageUrl: 'https://storage.googleapis.com/undefined/plants/new.jpg' });
    expect(res.status).toBe(200);
    const saved = store[plantPath('p1')];
    expect(saved.photoLog).toBeDefined();
    expect(saved.photoLog).toHaveLength(2);
    expect(saved.photoLog[0].url).toBe(oldUrl);
    expect(saved.photoLog[0].type).toBe('growth');
    expect(saved.photoLog[1].url).toBe('https://storage.googleapis.com/undefined/plants/new.jpg');
    expect(saved.photoLog[1].type).toBe('growth');
  });

  it('adds first imageUrl to photoLog when plant had no image', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    const newUrl = 'https://storage.googleapis.com/undefined/plants/first.jpg';
    await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Fern', imageUrl: newUrl });
    const saved = store[plantPath('p1')];
    expect(saved.photoLog).toHaveLength(1);
    expect(saved.photoLog[0].url).toBe(newUrl);
  });

  it('does not duplicate photoLog entry when imageUrl unchanged', async () => {
    const url = 'https://storage.googleapis.com/undefined/plants/same.jpg';
    store[plantPath('p1')] = { name: 'Fern', imageUrl: url, photoLog: [{ url, type: 'growth', date: '2026-01-01' }], createdAt: '2026-01-01T00:00:00.000Z' };
    await request(app)
      .put('/plants/p1').set('Authorization', authHeader())
      .send({ name: 'Fern', imageUrl: url });
    const saved = store[plantPath('p1')];
    expect(saved.photoLog).toHaveLength(1);
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

// ── Watering pattern — ML integration & caching ────────────────────────────

describe('GET /plants/:id/watering-pattern — ML & cache', () => {
  it('includes source: heuristic when no ML endpoint configured', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
    };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('heuristic');
  });

  it('uses Vertex AI when endpoint is configured', async () => {
    process.env.WATERING_PATTERN_ENDPOINT = 'ep-123';
    vertexaiPredictFn = async () => [{ pattern: 'over_watered', confidence: 0.92, contributingFactors: ['ML detected overwatering'] }];
    store[plantPath('p1')] = {
      name: 'Fern', species: 'Nephrolepis', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-04T00:00:00.000Z' },
        { date: '2026-01-07T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Good' }],
    };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pattern).toBe('over_watered');
    expect(res.body.source).toBe('vertex_ai');
    expect(res.body.confidence).toBe(0.92);
    delete process.env.WATERING_PATTERN_ENDPOINT;
  });

  it('falls back to heuristic when Vertex AI prediction fails', async () => {
    process.env.WATERING_PATTERN_ENDPOINT = 'ep-123';
    vertexaiPredictFn = async () => { throw new Error('Vertex AI down'); };
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
    };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('heuristic');
    delete process.env.WATERING_PATTERN_ENDPOINT;
  });

  it('returns cached result within TTL', async () => {
    const cachedResult = { pattern: 'optimal', confidence: 0.85, contributingFactors: ['Cached'], source: 'vertex_ai' };
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [{ date: '2026-01-01T00:00:00.000Z' }],
      mlCache: { wateringPattern: { result: cachedResult, cachedAt: new Date().toISOString() } },
    };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pattern).toBe('optimal');
    expect(res.body.source).toBe('vertex_ai');
    expect(res.body.contributingFactors).toEqual(['Cached']);
  });

  it('ignores expired cache and recomputes', async () => {
    const expired = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
      mlCache: { wateringPattern: { result: { pattern: 'stale' }, cachedAt: expired } },
    };
    const res = await request(app).get('/plants/p1/watering-pattern').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.pattern).not.toBe('stale');
    expect(res.body.source).toBe('heuristic');
  });
});

describe('POST /plants/:id/water — ML cache invalidation', () => {
  it('clears wateringPattern cache on new watering event', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [{ date: '2026-01-01T00:00:00.000Z' }],
      mlCache: { wateringPattern: { result: { pattern: 'optimal' }, cachedAt: new Date().toISOString() } },
    };
    const res = await request(app).post('/plants/p1/water').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(200);
    // Verify cache was cleared
    const data = store[plantPath('p1')];
    expect(data.mlCache.wateringPattern).toBeUndefined();
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

  it('returns CSV format when format=csv', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    store['users/user-csv-1'] = { email: 'a@b.com' };
    store['users/user-csv-1/plants/p1'] = {
      name: 'Fern', species: 'Nephrolepis', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Good' }],
    };
    const res = await request(app).get('/ml/export?format=csv').set('x-admin-token', 'test-token');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('species,days_between_waterings,recommended_frequency,adherence_ratio,health_at_watering,health_7d_after,season,consecutive_overdue_days,pot_size,room');
    expect(lines[1]).toContain('Nephrolepis');
    delete process.env.ML_ADMIN_TOKEN;
  });

  it('rejects invalid format parameter', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    const res = await request(app).get('/ml/export?format=xml').set('x-admin-token', 'test-token');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('format');
    delete process.env.ML_ADMIN_TOKEN;
  });

  it('writes to GCS when dest=gcs', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    process.env.ML_DATA_BUCKET = 'my-ml-bucket';
    store['users/user-gcs-1'] = { email: 'a@b.com' };
    store['users/user-gcs-1/plants/p1'] = {
      name: 'Fern', species: 'Nephrolepis', frequencyDays: 7,
      wateringLog: [
        { date: '2026-03-01T00:00:00.000Z' },
        { date: '2026-03-08T00:00:00.000Z' },
      ],
      healthLog: [],
    };
    const res = await request(app).get('/ml/export?dest=gcs&format=csv').set('x-admin-token', 'test-token');
    expect(res.status).toBe(200);
    expect(res.body.rows).toBe(1);
    expect(res.body.format).toBe('csv');
    expect(res.body.written).toContain('gs://my-ml-bucket/exports/');
    expect(res.body.written).toContain('.csv');
    expect(storageSavedFiles.length).toBe(1);
    expect(storageSavedFiles[0].content).toContain('Nephrolepis');
    delete process.env.ML_ADMIN_TOKEN;
    delete process.env.ML_DATA_BUCKET;
  });

  it('computes correct feature derivation values', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    store['users/user-feat-1'] = {};
    store['users/user-feat-1/plants/p1'] = {
      name: 'Aloe', species: 'Aloe Vera', frequencyDays: 14, potSize: 'medium', room: 'Living Room',
      wateringLog: [
        { date: '2026-06-01T00:00:00.000Z' },
        { date: '2026-06-08T00:00:00.000Z' },  // 7 days gap (overdue: < 14)
        { date: '2026-06-22T00:00:00.000Z' },  // 14 days gap (on time)
      ],
      healthLog: [
        { date: '2026-06-01T00:00:00.000Z', health: 'Good' },
        { date: '2026-06-10T00:00:00.000Z', health: 'Fair' },
      ],
    };
    const res = await request(app).get('/ml/export').set('x-admin-token', 'test-token');
    const rows = res.text.trim().split('\n').map(l => JSON.parse(l));
    expect(rows).toHaveLength(2);

    // First row: gap of 7 days, freq 14 → adherence 0.5
    expect(rows[0].species).toBe('Aloe Vera');
    expect(rows[0].days_between_waterings).toBe(7);
    expect(rows[0].adherence_ratio).toBe(0.5);
    expect(rows[0].season).toBe('summer');
    expect(rows[0].pot_size).toBe('medium');
    expect(rows[0].room).toBe('Living Room');

    // Second row: gap of 14 days, freq 14 → adherence 1.0
    expect(rows[1].days_between_waterings).toBe(14);
    expect(rows[1].adherence_ratio).toBe(1);
    expect(rows[1].consecutive_overdue_days).toBe(0);

    delete process.env.ML_ADMIN_TOKEN;
  });

  it('derives correct season from watering dates', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    store['users/user-season-1'] = {};
    store['users/user-season-1/plants/p1'] = {
      name: 'Plant', species: 'Test', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },  // winter
        { date: '2026-03-15T00:00:00.000Z' },  // spring
        { date: '2026-07-01T00:00:00.000Z' },  // summer
        { date: '2026-10-15T00:00:00.000Z' },  // autumn
        { date: '2026-12-25T00:00:00.000Z' },  // winter
      ],
      healthLog: [],
    };
    const res = await request(app).get('/ml/export').set('x-admin-token', 'test-token');
    const rows = res.text.trim().split('\n').map(l => JSON.parse(l));
    expect(rows.map(r => r.season)).toEqual(['spring', 'summer', 'autumn', 'winter']);
    delete process.env.ML_ADMIN_TOKEN;
  });
});

// ── GET /plants/:id/watering-recommendation ─────────────────────────────────

describe('GET /plants/:id/watering-recommendation', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/watering-recommendation').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/plants/p1/watering-recommendation');
    expect(res.status).toBe(401);
  });

  it('returns heuristic recommendation for plant with sufficient data', async () => {
    store[plantPath('p1')] = {
      name: 'Monstera', species: 'Monstera Deliciosa', frequencyDays: 10,
      lastWatered: '2026-03-01T00:00:00.000Z',
      wateringLog: [
        { date: '2026-02-01T00:00:00.000Z' },
        { date: '2026-02-11T00:00:00.000Z' },
        { date: '2026-02-21T00:00:00.000Z' },
        { date: '2026-03-01T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-02-01T00:00:00.000Z', health: 'Good' }],
    };
    const res = await request(app).get('/plants/p1/watering-recommendation').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.recommendedFrequencyDays).toBe(10);
    expect(res.body.confidenceInterval).toHaveLength(2);
    expect(res.body.basis).toContain('10-day');
    expect(res.body.nextWateringDate).toBeTruthy();
    expect(res.body.source).toBe('heuristic');
  });

  it('adjusts recommendation when plant is over-watered and declining', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', species: 'Nephrolepis', frequencyDays: 7,
      lastWatered: '2026-03-10T00:00:00.000Z',
      wateringLog: [
        { date: '2026-03-01T00:00:00.000Z' },
        { date: '2026-03-03T00:00:00.000Z' },
        { date: '2026-03-05T00:00:00.000Z' },
        { date: '2026-03-07T00:00:00.000Z' },
        { date: '2026-03-10T00:00:00.000Z' },
      ],
      healthLog: [
        { date: '2026-03-01T00:00:00.000Z', health: 'Good' },
        { date: '2026-03-10T00:00:00.000Z', health: 'Poor' },
      ],
      health: 'Poor',
    };
    const res = await request(app).get('/plants/p1/watering-recommendation').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.recommendedFrequencyDays).toBeGreaterThan(7);
    expect(res.body.basis).toContain('over-watered');
  });

  it('uses Vertex AI when endpoint is configured', async () => {
    process.env.WATERING_RECOMMENDATION_ENDPOINT = 'rec-ep-1';
    vertexaiPredictFn = async () => [{
      recommendedFrequencyDays: 8,
      confidenceInterval: [7, 10],
      basis: 'Based on 20 waterings — Monstera in spring does best every 8-10 days',
    }];
    store[plantPath('p1')] = {
      name: 'Monstera', species: 'Monstera Deliciosa', frequencyDays: 10,
      lastWatered: '2026-03-15T00:00:00.000Z',
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-11T00:00:00.000Z' },
        { date: '2026-01-21T00:00:00.000Z' },
        { date: '2026-02-01T00:00:00.000Z' },
        { date: '2026-02-11T00:00:00.000Z' },
        { date: '2026-03-15T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Good' }],
    };
    const res = await request(app).get('/plants/p1/watering-recommendation').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.recommendedFrequencyDays).toBe(8);
    expect(res.body.source).toBe('vertex_ai');
    delete process.env.WATERING_RECOMMENDATION_ENDPOINT;
  });

  it('returns cached recommendation within TTL', async () => {
    const cached = {
      recommendedFrequencyDays: 9, confidenceInterval: [8, 10],
      basis: 'Cached', nextWateringDate: '2026-04-01', source: 'vertex_ai',
    };
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      mlCache: { wateringRecommendation: { result: cached, cachedAt: new Date().toISOString() } },
    };
    const res = await request(app).get('/plants/p1/watering-recommendation').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.recommendedFrequencyDays).toBe(9);
    expect(res.body.source).toBe('vertex_ai');
  });

  it('invalidates recommendation cache on watering', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [{ date: '2026-01-01T00:00:00.000Z' }],
      mlCache: {
        wateringRecommendation: { result: { recommendedFrequencyDays: 9 }, cachedAt: new Date().toISOString() },
        wateringPattern: { result: { pattern: 'optimal' }, cachedAt: new Date().toISOString() },
      },
    };
    await request(app).post('/plants/p1/water').set('Authorization', authHeader()).send({});
    const data = store[plantPath('p1')];
    expect(data.mlCache.wateringRecommendation).toBeUndefined();
    expect(data.mlCache.wateringPattern).toBeUndefined();
  });
});

// ── GET /plants/:id/health-prediction ────────────────────────────────────────

describe('GET /plants/:id/health-prediction', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/health-prediction').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns heuristic prediction for healthy plant', async () => {
    store[plantPath('p1')] = {
      name: 'Monstera', species: 'Monstera', frequencyDays: 7, health: 'Good',
      lastWatered: new Date().toISOString(),
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
      healthLog: [
        { date: '2026-01-01T00:00:00.000Z', health: 'Good' },
        { date: '2026-01-15T00:00:00.000Z', health: 'Good' },
      ],
    };
    const res = await request(app).get('/plants/p1/health-prediction').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.predictedHealth).toBeTruthy();
    expect(res.body.horizon).toBe('14d');
    expect(res.body.trend).toBeTruthy();
    expect(res.body.keyRisks).toBeInstanceOf(Array);
    expect(res.body.source).toBe('heuristic');
  });

  it('detects risk when plant is overdue for watering', async () => {
    const oldDate = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 days ago
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7, health: 'Good',
      lastWatered: oldDate,
      wateringLog: [{ date: oldDate }],
      healthLog: [{ date: oldDate, health: 'Good' }],
    };
    const res = await request(app).get('/plants/p1/health-prediction').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.keyRisks.some(r => r.includes('Not watered'))).toBe(true);
    expect(res.body.trend).toBe('declining');
  });

  it('uses Vertex AI when endpoint configured', async () => {
    process.env.HEALTH_PREDICTION_ENDPOINT = 'health-ep-1';
    vertexaiPredictFn = async () => [{
      predictedHealth: 'Fair', probability: 0.82, trend: 'declining',
      keyRisks: ['Low watering adherence', 'Season change approaching'],
    }];
    store[plantPath('p1')] = {
      name: 'Fern', species: 'Nephrolepis', frequencyDays: 7, health: 'Good',
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Good' }],
    };
    const res = await request(app).get('/plants/p1/health-prediction').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.predictedHealth).toBe('Fair');
    expect(res.body.source).toBe('vertex_ai');
    expect(res.body.keyRisks).toHaveLength(2);
    delete process.env.HEALTH_PREDICTION_ENDPOINT;
  });

  it('returns cached prediction within TTL', async () => {
    const cached = {
      predictedHealth: 'Good', probability: 0.8, horizon: '14d',
      trend: 'stable', keyRisks: ['Cached'], source: 'vertex_ai',
    };
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      mlCache: { healthPrediction: { result: cached, cachedAt: new Date().toISOString() } },
    };
    const res = await request(app).get('/plants/p1/health-prediction').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.predictedHealth).toBe('Good');
    expect(res.body.keyRisks).toEqual(['Cached']);
  });

  it('invalidates health prediction cache on health change', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', health: 'Good',
      mlCache: {
        healthPrediction: { result: { predictedHealth: 'Good' }, cachedAt: new Date().toISOString() },
      },
    };
    await request(app).put('/plants/p1').set('Authorization', authHeader())
      .send({ health: 'Fair', healthReason: 'Wilting' });
    const data = store[plantPath('p1')];
    expect(data.mlCache.healthPrediction).toBeUndefined();
  });
});

// ── GET /plants/:id/seasonal-adjustment ──────────────────────────────────────

describe('GET /plants/:id/seasonal-adjustment', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/seasonal-adjustment').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns seasonal adjustment with heuristic', async () => {
    store[plantPath('p1')] = {
      name: 'Monstera', species: 'Monstera Deliciosa', frequencyDays: 10,
    };
    const res = await request(app).get('/plants/p1/seasonal-adjustment').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.season).toBeTruthy();
    expect(res.body.multiplier).toBeGreaterThan(0);
    expect(res.body.adjustedFrequencyDays).toBeGreaterThan(0);
    expect(res.body.note).toContain('Monstera Deliciosa');
    expect(res.body.source).toBe('heuristic');
  });

  it('uses hemisphere from user config', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', species: 'Nephrolepis', frequencyDays: 7,
    };
    store[`users/${USER_SUB}/config/preferences`] = { hemisphere: 'south' };
    const res = await request(app).get('/plants/p1/seasonal-adjustment').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    // Season should be valid
    expect(['spring', 'summer', 'autumn', 'winter']).toContain(res.body.season);
  });

  it('defaults to north hemisphere when no config', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
    };
    const res = await request(app).get('/plants/p1/seasonal-adjustment').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('heuristic');
  });

  it('uses Vertex AI when endpoint configured', async () => {
    process.env.SEASONAL_ADJUSTMENT_ENDPOINT = 'season-ep-1';
    vertexaiPredictFn = async () => [{ multiplier: 0.65, note: 'Winter dormancy for Monstera' }];
    store[plantPath('p1')] = {
      name: 'Monstera', species: 'Monstera', frequencyDays: 10,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
        { date: '2026-01-22T00:00:00.000Z' },
        { date: '2026-01-29T00:00:00.000Z' },
        { date: '2026-02-05T00:00:00.000Z' },
      ],
    };
    const res = await request(app).get('/plants/p1/seasonal-adjustment').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.multiplier).toBe(0.65);
    expect(res.body.source).toBe('vertex_ai');
    delete process.env.SEASONAL_ADJUSTMENT_ENDPOINT;
  });
});

// ── GET /plants/:id/care-score ───────────────────────────────────────────────

describe('GET /plants/:id/care-score', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/care-score').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns heuristic care score', async () => {
    store[plantPath('p1')] = {
      name: 'Monstera', species: 'Monstera', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
      healthLog: [
        { date: '2026-01-01T00:00:00.000Z', health: 'Good' },
        { date: '2026-01-15T00:00:00.000Z', health: 'Good' },
      ],
    };
    const res = await request(app).get('/plants/p1/care-score').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(res.body.grade);
    expect(res.body.dimensions).toHaveProperty('consistency');
    expect(res.body.dimensions).toHaveProperty('timing');
    expect(res.body.dimensions).toHaveProperty('healthOutcome');
    expect(res.body.dimensions).toHaveProperty('responsiveness');
    expect(res.body.source).toBe('heuristic');
  });

  it('scores well-cared-for plant higher than neglected one', async () => {
    // Well-cared plant
    store[plantPath('p1')] = {
      name: 'Good Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
        { date: '2026-01-22T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Excellent' }],
    };
    // Neglected plant
    store[plantPath('p2')] = {
      name: 'Sad Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-20T00:00:00.000Z' },
        { date: '2026-02-15T00:00:00.000Z' },
      ],
      healthLog: [
        { date: '2026-01-01T00:00:00.000Z', health: 'Good' },
        { date: '2026-02-15T00:00:00.000Z', health: 'Poor' },
      ],
    };
    const res1 = await request(app).get('/plants/p1/care-score').set('Authorization', authHeader());
    const res2 = await request(app).get('/plants/p2/care-score').set('Authorization', authHeader());
    expect(res1.body.score).toBeGreaterThan(res2.body.score);
  });

  it('returns cached care score', async () => {
    const cached = { score: 85, grade: 'B', dimensions: {}, trend: 0, scoredAt: '2026-01-01', source: 'vertex_ai' };
    store[plantPath('p1')] = {
      name: 'Fern',
      mlCache: { careScore: { result: cached, cachedAt: new Date().toISOString() } },
    };
    const res = await request(app).get('/plants/p1/care-score').set('Authorization', authHeader());
    expect(res.body.score).toBe(85);
    expect(res.body.source).toBe('vertex_ai');
  });
});

// ── GET /ml/care-scores ─────────────────────────────────────────────────────

describe('GET /ml/care-scores', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/ml/care-scores');
    expect(res.status).toBe(401);
  });

  it('returns scores for all plants sorted worst-first', async () => {
    store[plantPath('p1')] = {
      name: 'Good Plant', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Excellent' }],
    };
    store[plantPath('p2')] = {
      name: 'OK Plant', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-20T00:00:00.000Z' },
        { date: '2026-02-10T00:00:00.000Z' },
      ],
      healthLog: [{ date: '2026-01-01T00:00:00.000Z', health: 'Fair' }],
    };
    const res = await request(app).get('/ml/care-scores').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].score).toBeLessThanOrEqual(res.body[1].score);
    expect(res.body[0]).toHaveProperty('plantId');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('returns empty array when no plants', async () => {
    const res = await request(app).get('/ml/care-scores').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── GET /species/:name/cluster ───────────────────────────────────────────────

describe('GET /species/:name/cluster', () => {
  it('returns cluster for known tropical species', async () => {
    const res = await request(app).get('/species/Calathea/cluster').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.clusterId).toBe('thirsty_tropicals');
    expect(res.body.clusterLabel).toBe('Thirsty Tropicals');
    expect(res.body.similarSpecies).toBeInstanceOf(Array);
    expect(res.body.clusterCareProfile.droughtTolerance).toBe('low');
  });

  it('returns cluster for known drought-tolerant species', async () => {
    const res = await request(app).get('/species/Snake%20Plant/cluster').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.clusterId).toBe('drought_tolerant');
  });

  it('returns cluster for known forgiving foliage', async () => {
    const res = await request(app).get('/species/Monstera%20Deliciosa/cluster').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.clusterId).toBe('forgiving_foliage');
  });

  it('returns unknown for unrecognised species', async () => {
    const res = await request(app).get('/species/Xyloplantia/cluster').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.clusterId).toBeNull();
    expect(res.body.clusterLabel).toBe('Unknown');
    expect(res.body.source).toBe('none');
  });

  it('uses Firestore cluster assignments when available', async () => {
    store['config/clusters'] = {
      assignments: {
        'rare plant': { clusterId: 'forgiving_foliage', clusterLabel: 'Forgiving Foliage', similarSpecies: ['pothos'] },
      },
    };
    const res = await request(app).get('/species/Rare%20Plant/cluster').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.clusterId).toBe('forgiving_foliage');
    expect(res.body.source).toBe('trained');
  });

  it('uses Vertex AI when endpoint configured', async () => {
    process.env.SPECIES_CLUSTER_ENDPOINT = 'cluster-ep-1';
    vertexaiPredictFn = async () => [{ clusterId: 'seasonal_bloomers', clusterLabel: 'Seasonal Bloomers', similarSpecies: ['orchid'] }];
    const res = await request(app).get('/species/Christmas%20Cactus/cluster').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('vertex_ai');
    delete process.env.SPECIES_CLUSTER_ENDPOINT;
  });
});

// ── POST /ml/anomaly-scan ────────────────────────────────────────────────────

describe('POST /ml/anomaly-scan', () => {
  it('returns 403 without admin token', async () => {
    const res = await request(app).post('/ml/anomaly-scan');
    expect(res.status).toBe(403);
  });

  it('scans plants and detects anomalies', async () => {
    process.env.ML_ADMIN_TOKEN = 'test-token';
    store['users/u1'] = {};
    store['users/u1/plants/p1'] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
    };
    const res = await request(app).post('/ml/anomaly-scan').set('x-admin-token', 'test-token');
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(1);
    expect(typeof res.body.anomalies).toBe('number');
    // Verify cache was written
    const data = store['users/u1/plants/p1'];
    expect(data.mlCache.anomaly).toBeTruthy();
    delete process.env.ML_ADMIN_TOKEN;
  });
});

// ── GET /plants/:id/anomaly ─────────────────────────────────────────────────

describe('GET /plants/:id/anomaly', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/anomaly').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns cached anomaly result', async () => {
    const cached = { isAnomaly: true, score: 0.9, flags: ['Big gap'], detectedAt: '2026-03-01T00:00:00.000Z' };
    store[plantPath('p1')] = {
      name: 'Fern',
      mlCache: { anomaly: { result: cached, cachedAt: new Date().toISOString() } },
    };
    const res = await request(app).get('/plants/p1/anomaly').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.isAnomaly).toBe(true);
    expect(res.body.score).toBe(0.9);
    expect(res.body.flags).toEqual(['Big gap']);
  });

  it('computes on-demand when no cache exists', async () => {
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: '2026-01-01T00:00:00.000Z' },
        { date: '2026-01-08T00:00:00.000Z' },
        { date: '2026-01-15T00:00:00.000Z' },
      ],
    };
    const res = await request(app).get('/plants/p1/anomaly').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(typeof res.body.isAnomaly).toBe('boolean');
    expect(typeof res.body.score).toBe('number');
    expect(res.body.flags).toBeInstanceOf(Array);
  });

  it('detects anomaly for severely under-watered plant', async () => {
    const longAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: new Date(Date.now() - 90 * 86400000).toISOString() },
        { date: new Date(Date.now() - 60 * 86400000).toISOString() },
        { date: longAgo },
      ],
    };
    const res = await request(app).get('/plants/p1/anomaly').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThan(0);
    expect(res.body.flags.length).toBeGreaterThan(0);
  });

  it('returns no anomaly for well-maintained plant', async () => {
    const now = Date.now();
    store[plantPath('p1')] = {
      name: 'Fern', frequencyDays: 7,
      wateringLog: [
        { date: new Date(now - 14 * 86400000).toISOString() },
        { date: new Date(now - 7 * 86400000).toISOString() },
        { date: new Date(now - 1 * 86400000).toISOString() },
      ],
    };
    const res = await request(app).get('/plants/p1/anomaly').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.isAnomaly).toBe(false);
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


// ── POST /plants/:id/diagnostic ─────────────────────────────────────────────

const MOCK_DIAGNOSIS = {
  diagnoses: [
    { name: 'Spider mites', confidence: 0.85, category: 'pest', evidence: ['stippled leaves', 'fine webbing'], severity: 'moderate' },
  ],
  treatments: [
    { step: 1, action: 'Rinse foliage with water', urgency: 'today', safeForEdibles: true, productExamples: [] },
    { step: 2, action: 'Apply insecticidal soap', urgency: 'this-week', safeForEdibles: true, productExamples: ['Safer Brand Insect Killing Soap'] },
  ],
  preventiveCare: ['Increase humidity to 50%+', 'Inspect plants weekly'],
  escalation: { consultExpert: false, urgentFlags: [] },
};

describe('POST /plants/:id/diagnostic', () => {
  it('returns 404 for non-existent plant', async () => {
    const res = await request(app)
      .post('/plants/missing/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when imageBase64 is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern', createdAt: '2026-01-01T00:00:00.000Z' };
    const res = await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns structured diagnosis with diagnoses, treatments, preventiveCare, and escalation', async () => {
    store[plantPath('p1')] = { name: 'Monstera', createdAt: '2026-01-01T00:00:00.000Z' };
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(MOCK_DIAGNOSIS) } });

    const res = await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.diagnoses).toHaveLength(1);
    expect(res.body.analysis.diagnoses[0].name).toBe('Spider mites');
    expect(res.body.analysis.diagnoses[0].confidence).toBe(0.85);
    expect(res.body.analysis.treatments).toHaveLength(2);
    expect(res.body.analysis.preventiveCare).toHaveLength(2);
    expect(res.body.analysis.escalation.consultExpert).toBe(false);
    expect(res.body.diagnosisId).toBeTruthy();
    expect(res.body.type).toBe('diagnostic');
  });

  it('persists diagnosis entry to the diagnoses subcollection', async () => {
    store[plantPath('p1')] = { name: 'Monstera', createdAt: '2026-01-01T00:00:00.000Z' };
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(MOCK_DIAGNOSIS) } });

    const res = await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' });

    expect(res.status).toBe(200);
    const diagnosisId = res.body.diagnosisId;
    const diagnosisKey = Object.keys(store).find(k => k.includes('/diagnoses/'));
    expect(diagnosisKey).toBeTruthy();
    const savedDiagnosis = store[diagnosisKey];
    expect(savedDiagnosis.id).toBe(diagnosisId);
    expect(savedDiagnosis.analysis.diagnoses[0].name).toBe('Spider mites');
  });

  it('appends to photoLog with diagnosisId', async () => {
    store[plantPath('p1')] = { name: 'Fern', photoLog: [], createdAt: '2026-01-01T00:00:00.000Z' };
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(MOCK_DIAGNOSIS) } });

    await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg' });

    const saved = store[plantPath('p1')];
    expect(saved.photoLog).toHaveLength(1);
    expect(saved.photoLog[0].type).toBe('diagnostic');
    expect(saved.photoLog[0].diagnosisId).toBeTruthy();
  });

  it('propagates contextTags and treats edible-tagged plant with food-safe rule', async () => {
    store[plantPath('p1')] = { name: 'Basil', category: 'edible', createdAt: '2026-01-01T00:00:00.000Z' };
    let capturedContents;
    geminiGenerateFn = async (params) => {
      capturedContents = params.contents;
      return { response: { text: () => JSON.stringify(MOCK_DIAGNOSIS) } };
    };

    await request(app)
      .post('/plants/p1/diagnostic').set('Authorization', authHeader())
      .send({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg', contextTags: ['edible'] });

    const promptText = capturedContents[0].parts[1].text;
    expect(promptText).toContain('EDIBLE');
    expect(promptText).toContain('food-safe');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/plants/p1/diagnostic')
      .send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /plants/:id/photos ────────────────────────────────────────────────

describe('DELETE /plants/:id/photos', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/plants/p1/photos').send({ url: 'http://example.com/photo.jpg' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app)
      .delete('/plants/missing/photos').set('Authorization', authHeader())
      .send({ url: 'http://example.com/photo.jpg' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when url is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern', photoLog: [] };
    const res = await request(app)
      .delete('/plants/p1/photos').set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when photo url not found in log', async () => {
    store[plantPath('p1')] = { name: 'Fern', photoLog: [] };
    const res = await request(app)
      .delete('/plants/p1/photos').set('Authorization', authHeader())
      .send({ url: 'https://storage.googleapis.com/undefined/plants/missing.jpg' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Photo not found in log');
  });

  it('removes the photo from photoLog and deletes from GCS', async () => {
    const photoUrl = 'https://storage.googleapis.com/undefined/plants/growth1.jpg';
    store[plantPath('p1')] = {
      name: 'Fern',
      imageUrl: 'https://storage.googleapis.com/undefined/plants/other.jpg',
      photoLog: [
        { url: photoUrl, date: '2026-01-01T00:00:00.000Z', type: 'growth', analysis: null },
        { url: 'https://storage.googleapis.com/undefined/plants/other.jpg', date: '2026-01-02T00:00:00.000Z', type: 'growth', analysis: null },
      ],
    };
    const res = await request(app)
      .delete('/plants/p1/photos').set('Authorization', authHeader())
      .send({ url: photoUrl });
    expect(res.status).toBe(200);
    const saved = store[plantPath('p1')];
    expect(saved.photoLog).toHaveLength(1);
    expect(saved.photoLog[0].url).toBe('https://storage.googleapis.com/undefined/plants/other.jpg');
    expect(storageDeletedPaths).toContain('plants/growth1.jpg');
  });

  it('falls back imageUrl to latest growth photo when current image is deleted', async () => {
    const currentUrl = 'https://storage.googleapis.com/undefined/plants/current.jpg';
    const olderUrl = 'https://storage.googleapis.com/undefined/plants/older.jpg';
    store[plantPath('p1')] = {
      name: 'Fern',
      imageUrl: currentUrl,
      photoLog: [
        { url: olderUrl, date: '2026-01-01T00:00:00.000Z', type: 'growth', analysis: null },
        { url: currentUrl, date: '2026-01-02T00:00:00.000Z', type: 'growth', analysis: null },
      ],
    };
    const res = await request(app)
      .delete('/plants/p1/photos').set('Authorization', authHeader())
      .send({ url: currentUrl });
    expect(res.status).toBe(200);
    const saved = store[plantPath('p1')];
    expect(saved.imageUrl).toBe(olderUrl);
    expect(saved.photoLog).toHaveLength(1);
  });

  it('sets imageUrl to null when last photo is deleted', async () => {
    const onlyUrl = 'https://storage.googleapis.com/undefined/plants/only.jpg';
    store[plantPath('p1')] = {
      name: 'Fern',
      imageUrl: onlyUrl,
      photoLog: [
        { url: onlyUrl, date: '2026-01-01T00:00:00.000Z', type: 'growth', analysis: null },
      ],
    };
    const res = await request(app)
      .delete('/plants/p1/photos').set('Authorization', authHeader())
      .send({ url: onlyUrl });
    expect(res.status).toBe(200);
    const saved = store[plantPath('p1')];
    expect(saved.imageUrl).toBeNull();
    expect(saved.photoLog).toHaveLength(0);
  });
});

// ── POST /analyse-with-hint ──────────────────────────────────────────────────

describe('POST /analyse-with-hint', () => {
  it('returns 400 when imageBase64 is missing', async () => {
    const res = await request(app).post('/analyse-with-hint').send({ mimeType: 'image/jpeg', speciesHint: 'Monstera' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is missing', async () => {
    const res = await request(app).post('/analyse-with-hint').send({ imageBase64: 'abc', speciesHint: 'Monstera' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when speciesHint is missing', async () => {
    const res = await request(app).post('/analyse-with-hint').send({ imageBase64: 'abc', mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns parsed Gemini response with hint included in prompt', async () => {
    const payload = { species: 'Monstera deliciosa', frequencyDays: 7, health: 'Good', healthReason: 'Healthy', maturity: 'Mature', recommendations: ['Indirect light', 'Water weekly', 'Wipe leaves'] };
    geminiGenerateFn = async (args) => {
      // Verify the hint is included in the prompt text
      const promptText = args.contents[0].parts[1].text;
      expect(promptText).toContain('Monstera');
      return { response: { text: () => JSON.stringify(payload) } };
    };
    const res = await request(app).post('/analyse-with-hint').send({ imageBase64: 'abc123', mimeType: 'image/jpeg', speciesHint: 'Monstera' });
    expect(res.status).toBe(200);
    expect(res.body.species).toBe('Monstera deliciosa');
    expect(res.body.frequencyDays).toBe(7);
  });

  it('returns 500 if Gemini throws', async () => {
    geminiGenerateFn = async () => { throw new Error('Gemini unavailable'); };
    const res = await request(app).post('/analyse-with-hint').send({ imageBase64: 'abc', mimeType: 'image/jpeg', speciesHint: 'Fern' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Gemini unavailable');
  });
});

// ── Billing routes ───────────────────────────────────────────────────────────

describe('Billing routes — dark mode (BILLING_ENABLED unset)', () => {
  it('GET /billing/subscription returns free tier with billingEnabled=false', async () => {
    delete process.env.BILLING_ENABLED;
    const res = await request(app).get('/billing/subscription').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.billingEnabled).toBe(false);
    expect(res.body.tier).toBe('free');
    expect(res.body.quotas.plants).toBe(10);
    expect(res.body.usage).toEqual({ plants: 0, ai_analyses: 0, photo_storage_mb: 0 });
  });

  it('POST /billing/create-checkout-session returns 503 when billing disabled', async () => {
    delete process.env.BILLING_ENABLED;
    const res = await request(app).post('/billing/create-checkout-session')
      .set('Authorization', authHeader())
      .send({ tier: 'home_pro', interval: 'month' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('billing_disabled');
  });

  it('POST /billing/create-portal-session returns 503 when billing disabled', async () => {
    delete process.env.BILLING_ENABLED;
    const res = await request(app).post('/billing/create-portal-session').set('Authorization', authHeader());
    expect(res.status).toBe(503);
  });

  it('POST /billing/webhook returns 503 when billing disabled', async () => {
    delete process.env.BILLING_ENABLED;
    const res = await request(app).post('/billing/webhook').send({});
    expect(res.status).toBe(503);
  });
});

describe('Billing — tier gating is a no-op when BILLING_ENABLED is unset', () => {
  it('POST /plants allows unlimited plants when billing is disabled', async () => {
    delete process.env.BILLING_ENABLED;
    for (let i = 0; i < 11; i++) {
      store[plantPath(`p-seed-${i}`)] = { name: `Seed ${i}` };
    }
    const res = await request(app).post('/plants').set('Authorization', authHeader()).send({ name: 'Eleventh' });
    expect([200, 201]).toContain(res.status);
  });
});

describe('Billing — tier gating enforces plant quota when BILLING_ENABLED=true', () => {
  it('free-tier user is blocked at the 11th plant with 429 quota_exceeded', async () => {
    process.env.BILLING_ENABLED = 'true';
    for (let i = 0; i < 10; i++) {
      store[plantPath(`p-${i}`)] = { name: `Plant ${i}` };
    }
    const res = await request(app).post('/plants').set('Authorization', authHeader()).send({ name: 'Eleventh' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('quota_exceeded');
    expect(res.body.quotaType).toBe('plants');
    expect(res.body.limit).toBe(10);
    expect(res.body.upgradeUrl).toBe('/pricing');
    delete process.env.BILLING_ENABLED;
  });

  it('home_pro user is allowed past the free-tier plant limit', async () => {
    process.env.BILLING_ENABLED = 'true';
    store[`users/${USER_SUB}/subscription/current`] = { tier: 'home_pro', status: 'active' };
    for (let i = 0; i < 10; i++) {
      store[plantPath(`p-${i}`)] = { name: `Plant ${i}` };
    }
    const res = await request(app).post('/plants').set('Authorization', authHeader()).send({ name: 'Eleventh' });
    expect([200, 201]).toContain(res.status);
    delete process.env.BILLING_ENABLED;
  });
});

describe('Billing — requireTier on /plants/:id/health-prediction', () => {
  it('403s a free-tier user with upgrade_required when billing enabled', async () => {
    process.env.BILLING_ENABLED = 'true';
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).get('/plants/p1/health-prediction').set('Authorization', authHeader());
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('upgrade_required');
    expect(res.body.requiredTier).toBe('home_pro');
    expect(res.body.currentTier).toBe('free');
    delete process.env.BILLING_ENABLED;
  });
});

// ── POST /plants/:id/fertilise ───────────────────────────────────────────────

describe('POST /plants/:id/fertilise', () => {
  it('returns 404 for a non-existent plant', async () => {
    const res = await request(app).post('/plants/missing/fertilise').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(404);
  });

  it('appends to an existing fertiliserLog and updates lastFertilised', async () => {
    store[plantPath('p1')] = {
      name: 'Monstera',
      fertiliserLog: [{ date: '2026-01-01T00:00:00.000Z', productName: 'Old feed' }],
    };
    const res = await request(app).post('/plants/p1/fertilise').set('Authorization', authHeader()).send({
      productName: 'Balanced liquid houseplant food',
      npk: '10-10-10',
      dilution: '5ml per 1L',
      amount: '250ml',
      notes: 'weekly feed',
    });
    expect(res.status).toBe(200);
    expect(res.body.fertiliserLog).toHaveLength(2);
    expect(res.body.fertiliserLog[1].productName).toBe('Balanced liquid houseplant food');
    expect(res.body.fertiliserLog[1].dilution).toBe('5ml per 1L');
    expect(res.body.fertiliserLog[1].notes).toBe('weekly feed');
    expect(res.body.lastFertilised).toBeTruthy();
  });

  it('remembers product + dilution on the plant.fertiliser block for quick repeat', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    const res = await request(app).post('/plants/p1/fertilise').set('Authorization', authHeader()).send({
      productName: 'Tomato feed', npk: '4-4-8', dilution: '10ml per 1L',
    });
    expect(res.status).toBe(200);
    expect(res.body.fertiliser).toEqual(expect.objectContaining({
      productName: 'Tomato feed', npk: '4-4-8', dilution: '10ml per 1L',
    }));
  });

  it('creates a fertiliserLog from scratch and accepts minimal payload', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app).post('/plants/p1/fertilise').set('Authorization', authHeader()).send({});
    expect(res.status).toBe(200);
    expect(res.body.fertiliserLog).toHaveLength(1);
    expect(res.body.fertiliserLog[0].productName).toBeNull();
    expect(res.body.lastFertilised).toBeTruthy();
  });

  it('signs imageUrl in the response when plant has an image', async () => {
    store[plantPath('p1')] = { name: 'Fern', imageUrl: 'plants/fern.jpg' };
    storageSignedUrlFn = async () => ['https://signed.url/fern-fed.jpg'];
    const res = await request(app).post('/plants/p1/fertilise').set('Authorization', authHeader()).send({});
    expect(res.body.imageUrl).toBe('https://signed.url/fern-fed.jpg');
  });
});

// ── POST /recommend-fertiliser ───────────────────────────────────────────────

describe('POST /recommend-fertiliser', () => {
  const payload = {
    productName: 'Balanced liquid houseplant food',
    npk: '10-10-10',
    dilution: '5ml per 1L water',
    amount: '250-500ml per pot',
    frequencyDays: 14,
    season: 'Feed in spring and summer; hold off in winter.',
    signs: 'Pale new leaves = hungry. Brown tips/salt crust = overfed.',
    summary: 'Feed every fortnight in the growing season at half strength.',
  };

  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/recommend-fertiliser').send({});
    expect(res.status).toBe(400);
  });

  it('returns structured fertiliser recommendations', async () => {
    geminiGenerateFn = async () => ({ response: { text: () => JSON.stringify(payload) } });
    const res = await request(app).post('/recommend-fertiliser').send({
      name: 'Monstera', species: 'Monstera deliciosa', plantedIn: 'pot', isOutdoor: false,
      potSize: 'medium', soilType: 'well-draining', health: 'Good', season: 'spring',
    });
    expect(res.status).toBe(200);
    expect(res.body.productName).toBe('Balanced liquid houseplant food');
    expect(res.body.npk).toBe('10-10-10');
    expect(res.body.frequencyDays).toBe(14);
    expect(res.body.dilution).toBeTruthy();
    expect(res.body.amount).toBeTruthy();
    expect(res.body.signs).toBeTruthy();
    expect(res.body.summary).toBeTruthy();
  });

  it('threads location and hemisphere context into the prompt and bans USDA', async () => {
    let capturedPrompt = null;
    geminiGenerateFn = async (req) => {
      capturedPrompt = req.contents[0].parts[0].text;
      return { response: { text: () => JSON.stringify(payload) } };
    };
    await request(app).post('/recommend-fertiliser').send({
      name: 'Lemon tree', species: 'Citrus limon',
      location: { name: 'Sydney', country: 'Australia' },
      tempUnit: 'C',
    });
    expect(capturedPrompt).toMatch(/Sydney, Australia/);
    expect(capturedPrompt).toMatch(/USDA/); // "Do not use USDA hardiness zones" instruction
  });

  it('returns 500 when Gemini throws', async () => {
    geminiGenerateFn = async () => { throw new Error('Gemini down'); };
    const res = await request(app).post('/recommend-fertiliser').send({ name: 'Rose' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Gemini down');
  });
});


// ── Growth measurements ───────────────────────────────────────────────────────

describe('GET /plants/:id/measurements', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/plants/p1/measurements');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/measurements')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns empty array when plant has no measurements', async () => {
    store[plantPath('p1')] = { species: 'Fern' };
    const res = await request(app).get('/plants/p1/measurements')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns existing measurements array', async () => {
    const measurements = [{ id: 'uuid-1', date: '2026-01-01', height_cm: 45, notes: '' }];
    store[plantPath('p1')] = { species: 'Monstera', measurements };
    const res = await request(app).get('/plants/p1/measurements')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(measurements);
  });
});

describe('POST /plants/:id/measurements', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/plants/p1/measurements').send({ height_cm: 30 });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).post('/plants/missing/measurements')
      .set('Authorization', authHeader()).send({ height_cm: 30 });
    expect(res.status).toBe(404);
  });

  it('returns 400 when no measurement values provided', async () => {
    store[plantPath('p1')] = { species: 'Fern' };
    const res = await request(app).post('/plants/p1/measurements')
      .set('Authorization', authHeader()).send({ notes: 'just notes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it('creates a measurement with height_cm and returns 201', async () => {
    store[plantPath('p1')] = { species: 'Monstera' };
    const res = await request(app).post('/plants/p1/measurements')
      .set('Authorization', authHeader()).send({ height_cm: 45, notes: 'looking good' });
    expect(res.status).toBe(201);
    expect(res.body.height_cm).toBe(45);
    expect(res.body.notes).toBe('looking good');
    expect(res.body.id).toBeDefined();
    expect(res.body.date).toBeDefined();
    expect(store[plantPath('p1')].measurements).toHaveLength(1);
    expect(store[plantPath('p1')].measurements[0].height_cm).toBe(45);
  });

  it('creates a measurement with multiple fields', async () => {
    store[plantPath('p1')] = { species: 'Monstera' };
    const res = await request(app).post('/plants/p1/measurements')
      .set('Authorization', authHeader())
      .send({ height_cm: 50, width_cm: 30, leafCount: 12, stemCount: 2 });
    expect(res.status).toBe(201);
    expect(res.body.width_cm).toBe(30);
    expect(res.body.leafCount).toBe(12);
    expect(res.body.stemCount).toBe(2);
  });

  it('appends to existing measurements', async () => {
    const existing = [{ id: 'old-1', date: '2026-01-01', height_cm: 40, notes: '' }];
    store[plantPath('p1')] = { species: 'Monstera', measurements: existing };
    await request(app).post('/plants/p1/measurements')
      .set('Authorization', authHeader()).send({ height_cm: 45 });
    expect(store[plantPath('p1')].measurements).toHaveLength(2);
  });

  it('accepts leafCount only (no height)', async () => {
    store[plantPath('p1')] = { species: 'Pothos' };
    const res = await request(app).post('/plants/p1/measurements')
      .set('Authorization', authHeader()).send({ leafCount: 8 });
    expect(res.status).toBe(201);
    expect(res.body.leafCount).toBe(8);
    expect(res.body.height_cm).toBeUndefined();
  });
});

describe('DELETE /plants/:id/measurements/:measurementId', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).delete('/plants/p1/measurements/mid1');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).delete('/plants/missing/measurements/mid1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('removes the matching measurement and returns { deleted: true }', async () => {
    store[plantPath('p1')] = {
      species: 'Monstera',
      measurements: [
        { id: 'mid1', date: '2026-01-01', height_cm: 40, notes: '' },
        { id: 'mid2', date: '2026-02-01', height_cm: 45, notes: '' },
      ],
    };
    const res = await request(app).delete('/plants/p1/measurements/mid1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(store[plantPath('p1')].measurements).toHaveLength(1);
    expect(store[plantPath('p1')].measurements[0].id).toBe('mid2');
  });

  it('is a no-op when measurement id does not exist', async () => {
    store[plantPath('p1')] = { species: 'Fern', measurements: [{ id: 'mid1', height_cm: 10, notes: '' }] };
    const res = await request(app).delete('/plants/p1/measurements/nonexistent')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(store[plantPath('p1')].measurements).toHaveLength(1);
  });
});

// ── Phenology events ──────────────────────────────────────────────────────────

describe('GET /plants/:id/phenology', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/plants/p1/phenology');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).get('/plants/missing/phenology')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns empty array when plant has no phenology events', async () => {
    store[plantPath('p1')] = { species: 'Rose' };
    const res = await request(app).get('/plants/p1/phenology')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns existing phenology events', async () => {
    const events = [{ id: 'ev1', date: '2026-04-14', event: 'first-bloom', notes: 'pink flowers' }];
    store[plantPath('p1')] = { species: 'Rose', phenologyEvents: events };
    const res = await request(app).get('/plants/p1/phenology')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(events);
  });
});

describe('POST /plants/:id/phenology', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/plants/p1/phenology').send({ event: 'first-bloom' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).post('/plants/missing/phenology')
      .set('Authorization', authHeader()).send({ event: 'first-bloom' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when event is missing', async () => {
    store[plantPath('p1')] = { species: 'Rose' };
    const res = await request(app).post('/plants/p1/phenology')
      .set('Authorization', authHeader()).send({ notes: 'no event type' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/event must be one of/);
  });

  it('returns 400 for invalid event type', async () => {
    store[plantPath('p1')] = { species: 'Rose' };
    const res = await request(app).post('/plants/p1/phenology')
      .set('Authorization', authHeader()).send({ event: 'invalid-type' });
    expect(res.status).toBe(400);
  });

  it('creates a phenology event and returns 201', async () => {
    store[plantPath('p1')] = { species: 'Rose' };
    const res = await request(app).post('/plants/p1/phenology')
      .set('Authorization', authHeader())
      .send({ event: 'first-bloom', notes: 'Beautiful pink flowers', date: '2026-04-14' });
    expect(res.status).toBe(201);
    expect(res.body.event).toBe('first-bloom');
    expect(res.body.notes).toBe('Beautiful pink flowers');
    expect(res.body.date).toBe('2026-04-14');
    expect(res.body.id).toBeDefined();
    expect(store[plantPath('p1')].phenologyEvents).toHaveLength(1);
  });

  it('accepts all valid event types', async () => {
    const validEvents = ['first-leaf', 'first-bud', 'first-bloom', 'first-fruit', 'leaf-drop', 'dormancy', 'new-growth', 'other'];
    for (const event of validEvents) {
      store[plantPath('plant-ev')] = { species: 'Test' };
      const res = await request(app).post('/plants/plant-ev/phenology')
        .set('Authorization', authHeader()).send({ event });
      expect(res.status).toBe(201);
    }
  });

  it('uses current timestamp when date is not provided', async () => {
    store[plantPath('p1')] = { species: 'Rose' };
    const before = new Date().toISOString();
    const res = await request(app).post('/plants/p1/phenology')
      .set('Authorization', authHeader()).send({ event: 'new-growth' });
    expect(res.status).toBe(201);
    expect(new Date(res.body.date) >= new Date(before)).toBe(true);
  });

  it('appends to existing phenology events', async () => {
    const existing = [{ id: 'ev1', date: '2026-01-01', event: 'first-leaf', notes: '' }];
    store[plantPath('p1')] = { species: 'Rose', phenologyEvents: existing };
    await request(app).post('/plants/p1/phenology')
      .set('Authorization', authHeader()).send({ event: 'first-bloom' });
    expect(store[plantPath('p1')].phenologyEvents).toHaveLength(2);
  });
});

describe('DELETE /plants/:id/phenology/:eventId', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).delete('/plants/p1/phenology/ev1');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent plant', async () => {
    const res = await request(app).delete('/plants/missing/phenology/ev1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('removes the matching phenology event', async () => {
    store[plantPath('p1')] = {
      species: 'Rose',
      phenologyEvents: [
        { id: 'ev1', date: '2026-01-01', event: 'first-leaf', notes: '' },
        { id: 'ev2', date: '2026-04-14', event: 'first-bloom', notes: '' },
      ],
    };
    const res = await request(app).delete('/plants/p1/phenology/ev1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(store[plantPath('p1')].phenologyEvents).toHaveLength(1);
    expect(store[plantPath('p1')].phenologyEvents[0].id).toBe('ev2');
  });
});

// ── GET /plants/:id/journal ───────────────────────────────────────────────────

describe('GET /plants/:id/journal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/plants/p1/journal');
    expect(res.status).toBe(401);
  });

  it('returns 404 when plant does not exist', async () => {
    const res = await request(app)
      .get('/plants/missing/journal')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns empty array when no journal entries exist', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .get('/plants/p1/journal')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns journal entries sorted newest-first', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      journalEntries: [
        { id: 'e1', date: '2026-01-01T00:00:00Z', body: 'First', tags: [], mood: null, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'e2', date: '2026-03-01T00:00:00Z', body: 'Third', tags: [], mood: null, createdAt: '2026-03-01T00:00:00Z' },
        { id: 'e3', date: '2026-02-01T00:00:00Z', body: 'Second', tags: [], mood: null, createdAt: '2026-02-01T00:00:00Z' },
      ],
    };
    const res = await request(app)
      .get('/plants/p1/journal')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.map(e => e.id)).toEqual(['e2', 'e3', 'e1']);
  });
});

// ── POST /plants/:id/journal ──────────────────────────────────────────────────

describe('POST /plants/:id/journal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/plants/p1/journal').send({ body: 'note' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when plant does not exist', async () => {
    const res = await request(app)
      .post('/plants/missing/journal')
      .set('Authorization', authHeader())
      .send({ body: 'note' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when body is missing', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body is required/i);
  });

  it('returns 400 when body is empty string', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({ body: '   ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid tags', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({ body: 'note', tags: ['notavalidtag'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid tags/i);
  });

  it('returns 400 for invalid mood', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({ body: 'note', mood: 'ecstatic' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mood must be one of/i);
  });

  it('creates a journal entry and returns 201', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({ body: 'New shoot appeared', mood: 'thriving', tags: ['new-growth'] });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.body).toBe('New shoot appeared');
    expect(res.body.mood).toBe('thriving');
    expect(res.body.tags).toEqual(['new-growth']);
    expect(res.body.date).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('persists the entry in Firestore', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({ body: 'Persisted note', tags: [] });
    const saved = store[plantPath('p1')];
    expect(saved.journalEntries).toHaveLength(1);
    expect(saved.journalEntries[0].body).toBe('Persisted note');
  });

  it('defaults mood to null and tags to [] when omitted', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .post('/plants/p1/journal')
      .set('Authorization', authHeader())
      .send({ body: 'Simple note' });
    expect(res.status).toBe(201);
    expect(res.body.mood).toBeNull();
    expect(res.body.tags).toEqual([]);
  });
});

// ── PUT /plants/:id/journal/:entryId ─────────────────────────────────────────

describe('PUT /plants/:id/journal/:entryId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).put('/plants/p1/journal/e1').send({ body: 'updated' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when plant does not exist', async () => {
    const res = await request(app)
      .put('/plants/missing/journal/e1')
      .set('Authorization', authHeader())
      .send({ body: 'updated' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when entry does not exist', async () => {
    store[plantPath('p1')] = { name: 'Fern', journalEntries: [] };
    const res = await request(app)
      .put('/plants/p1/journal/nonexistent')
      .set('Authorization', authHeader())
      .send({ body: 'updated' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/journal entry not found/i);
  });

  it('returns 400 when body is set to empty string', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      journalEntries: [{ id: 'e1', date: '2026-01-01T00:00:00Z', body: 'Original', tags: [], mood: null, createdAt: '2026-01-01T00:00:00Z' }],
    };
    const res = await request(app)
      .put('/plants/p1/journal/e1')
      .set('Authorization', authHeader())
      .send({ body: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/body cannot be empty/i);
  });

  it('returns 400 for invalid tags', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      journalEntries: [{ id: 'e1', date: '2026-01-01T00:00:00Z', body: 'Original', tags: [], mood: null, createdAt: '2026-01-01T00:00:00Z' }],
    };
    const res = await request(app)
      .put('/plants/p1/journal/e1')
      .set('Authorization', authHeader())
      .send({ tags: ['badtag'] });
    expect(res.status).toBe(400);
  });

  it('updates the entry body and returns 200', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      journalEntries: [{ id: 'e1', date: '2026-01-01T00:00:00Z', body: 'Original', tags: [], mood: null, createdAt: '2026-01-01T00:00:00Z' }],
    };
    const res = await request(app)
      .put('/plants/p1/journal/e1')
      .set('Authorization', authHeader())
      .send({ body: 'Updated body', mood: 'ok', tags: ['bloom'] });
    expect(res.status).toBe(200);
    expect(res.body.body).toBe('Updated body');
    expect(res.body.mood).toBe('ok');
    expect(res.body.tags).toEqual(['bloom']);
    expect(res.body.updatedAt).toBeDefined();
  });
});

// ── DELETE /plants/:id/journal/:entryId ──────────────────────────────────────

describe('DELETE /plants/:id/journal/:entryId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/plants/p1/journal/e1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when plant does not exist', async () => {
    const res = await request(app)
      .delete('/plants/missing/journal/e1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('deletes the entry and returns { deleted: true }', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      journalEntries: [
        { id: 'e1', body: 'Keep', date: '2026-01-01T00:00:00Z', tags: [], mood: null, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'e2', body: 'Remove', date: '2026-02-01T00:00:00Z', tags: [], mood: null, createdAt: '2026-02-01T00:00:00Z' },
      ],
    };
    const res = await request(app)
      .delete('/plants/p1/journal/e2')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: true });
    expect(store[plantPath('p1')].journalEntries).toHaveLength(1);
    expect(store[plantPath('p1')].journalEntries[0].id).toBe('e1');
  });
});

// ── DELETE /account ───────────────────────────────────────────────────────────

describe('DELETE /account', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/account');
    expect(res.status).toBe(401);
  });

  it('returns 204 when user has no plants or config', async () => {
    const res = await request(app).delete('/account').set('Authorization', authHeader());
    expect(res.status).toBe(204);
  });

  it('deletes all plant documents', async () => {
    store[plantPath('p1')] = { name: 'Rose' };
    store[plantPath('p2')] = { name: 'Fern' };

    const res = await request(app).delete('/account').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(store[plantPath('p1')]).toBeUndefined();
    expect(store[plantPath('p2')]).toBeUndefined();
  });

  it('deletes plant subcollections (measurements, phenology, journal)', async () => {
    store[plantPath('p1')] = { name: 'Rose' };
    store[`users/${USER_SUB}/plants/p1/measurements/m1`] = { value: 5, measuredAt: '2024-01-01' };
    store[`users/${USER_SUB}/plants/p1/phenology/ph1`] = { event: 'bloom', observedAt: '2024-02-01' };
    store[`users/${USER_SUB}/plants/p1/journal/j1`] = { body: 'looking great', createdAt: '2024-01-15' };

    await request(app).delete('/account').set('Authorization', authHeader());

    expect(store[`users/${USER_SUB}/plants/p1/measurements/m1`]).toBeUndefined();
    expect(store[`users/${USER_SUB}/plants/p1/phenology/ph1`]).toBeUndefined();
    expect(store[`users/${USER_SUB}/plants/p1/journal/j1`]).toBeUndefined();
  });

  it('deletes config documents', async () => {
    store[`users/${USER_SUB}/config/floors`] = { floors: [] };
    store[`users/${USER_SUB}/config/floorplan`] = { imageUrl: null };

    await request(app).delete('/account').set('Authorization', authHeader());

    expect(store[`users/${USER_SUB}/config/floors`]).toBeUndefined();
    expect(store[`users/${USER_SUB}/config/floorplan`]).toBeUndefined();
  });

  it('deletes GCS images from plant imageUrl', async () => {
    store[plantPath('p1')] = {
      name: 'Fern',
      imageUrl: 'https://storage.googleapis.com/undefined/plants/fern.jpg',
    };

    await request(app).delete('/account').set('Authorization', authHeader());

    expect(storageDeletedPaths).toContain('plants/fern.jpg');
  });

  it('deletes GCS images from plant photoLog', async () => {
    store[plantPath('p1')] = {
      name: 'Orchid',
      imageUrl: null,
      photoLog: [
        { url: 'https://storage.googleapis.com/undefined/plants/orchid1.jpg', date: '2024-01-01' },
        { url: 'https://storage.googleapis.com/undefined/plants/orchid2.jpg', date: '2024-02-01' },
      ],
    };

    await request(app).delete('/account').set('Authorization', authHeader());

    expect(storageDeletedPaths).toContain('plants/orchid1.jpg');
    expect(storageDeletedPaths).toContain('plants/orchid2.jpg');
  });

  it('still succeeds even if GCS delete fails', async () => {
    store[plantPath('p1')] = {
      name: 'Cactus',
      imageUrl: 'https://storage.googleapis.com/undefined/plants/cactus.jpg',
    };
    storageDeleteFn = async () => { throw new Error('GCS error'); };

    const res = await request(app).delete('/account').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(store[plantPath('p1')]).toBeUndefined();
  });
});

// ── GET /account/export ───────────────────────────────────────────────────────

describe('GET /account/export', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/account/export');
    expect(res.status).toBe(401);
  });

  it('returns 200 with export structure when no data exists', async () => {
    const res = await request(app).get('/account/export').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.plants).toEqual([]);
    expect(res.body.floors).toEqual([]);
    expect(res.body.exportedAt).toBeTruthy();
    expect(res.body.userId).toBe(USER_SUB);
  });

  it('includes plant data in the export', async () => {
    store[plantPath('p1')] = { name: 'Rose', species: 'Rosa' };
    store[plantPath('p2')] = { name: 'Fern', species: 'Nephrolepis' };

    const res = await request(app).get('/account/export').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.plants).toHaveLength(2);
    const names = res.body.plants.map(p => p.name);
    expect(names).toContain('Rose');
    expect(names).toContain('Fern');
  });

  it('includes subcollection data in the export', async () => {
    store[plantPath('p1')] = { name: 'Monstera' };
    store[`users/${USER_SUB}/plants/p1/measurements/m1`] = { value: 30, measuredAt: '2024-03-01' };
    store[`users/${USER_SUB}/plants/p1/journal/j1`] = { body: 'First leaf', createdAt: '2024-03-01' };

    const res = await request(app).get('/account/export').set('Authorization', authHeader());
    expect(res.status).toBe(200);

    const plant = res.body.plants[0];
    expect(plant.measurements).toHaveLength(1);
    expect(plant.measurements[0].value).toBe(30);
    expect(plant.journalEntries).toHaveLength(1);
    expect(plant.journalEntries[0].body).toBe('First leaf');
  });

  it('includes floors config in the export', async () => {
    store[`users/${USER_SUB}/config/floors`] = { floors: [{ id: 'g1', name: 'Ground Floor' }] };

    const res = await request(app).get('/account/export').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.floors).toHaveLength(1);
    expect(res.body.floors[0].name).toBe('Ground Floor');
  });

  it('strips signed URL query params from imageUrl', async () => {
    store[plantPath('p1')] = {
      name: 'Lily',
      imageUrl: 'https://storage.googleapis.com/undefined/plants/lily.jpg?X-Goog-Signature=abc',
    };

    const res = await request(app).get('/account/export').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.plants[0].imageUrl).toBe('https://storage.googleapis.com/undefined/plants/lily.jpg');
  });
});

// ── GET /plants/:id/harvests ──────────────────────────────────────────────────

describe('GET /plants/:id/harvests', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/plants/p1/harvests');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown plant', async () => {
    const res = await request(app)
      .get('/plants/missing/harvests')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns empty array when no harvests exist', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    const res = await request(app)
      .get('/plants/p1/harvests')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns harvest entries sorted newest-first', async () => {
    store[plantPath('p1')] = {
      name: 'Tomato',
      harvestLog: [
        { id: 'h1', date: '2026-01-01', quantity: 1, unit: 'kg' },
        { id: 'h2', date: '2026-03-01', quantity: 2, unit: 'kg' },
      ],
    };
    const res = await request(app)
      .get('/plants/p1/harvests')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('h2');
    expect(res.body[1].id).toBe('h1');
  });
});

// ── POST /plants/:id/harvests ─────────────────────────────────────────────────

describe('POST /plants/:id/harvests', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/plants/p1/harvests').send({ quantity: 1, unit: 'kg' });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown plant', async () => {
    const res = await request(app)
      .post('/plants/missing/harvests')
      .send({ quantity: 1, unit: 'kg' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns 400 when quantity is missing', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    const res = await request(app)
      .post('/plants/p1/harvests')
      .send({ unit: 'kg' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quantity/i);
  });

  it('returns 400 when unit is invalid', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    const res = await request(app)
      .post('/plants/p1/harvests')
      .send({ quantity: 1, unit: 'gallons' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unit/i);
  });

  it('returns 400 when quality is out of range', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    const res = await request(app)
      .post('/plants/p1/harvests')
      .send({ quantity: 1, unit: 'kg', quality: 6 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/quality/i);
  });

  it('creates a harvest entry and returns 201', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    const res = await request(app)
      .post('/plants/p1/harvests')
      .send({ date: '2026-07-15', quantity: 2.5, unit: 'kg', quality: 4, notes: 'Best batch yet' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(2.5);
    expect(res.body.unit).toBe('kg');
    expect(res.body.quality).toBe(4);
    expect(res.body.notes).toBe('Best batch yet');
    expect(res.body.id).toBeDefined();
  });

  it('persists harvest entry to the plant document', async () => {
    store[plantPath('p1')] = { name: 'Tomato' };
    await request(app)
      .post('/plants/p1/harvests')
      .send({ quantity: 500, unit: 'g' })
      .set('Authorization', authHeader());
    const saved = store[plantPath('p1')];
    expect(saved.harvestLog).toHaveLength(1);
    expect(saved.harvestLog[0].quantity).toBe(500);
    expect(saved.harvestLog[0].unit).toBe('g');
  });

  it('accepts count and bunches units', async () => {
    store[plantPath('p1')] = { name: 'Herb' };
    const r1 = await request(app)
      .post('/plants/p1/harvests')
      .send({ quantity: 10, unit: 'count' })
      .set('Authorization', authHeader());
    expect(r1.status).toBe(201);
    const r2 = await request(app)
      .post('/plants/p1/harvests')
      .send({ quantity: 3, unit: 'bunches' })
      .set('Authorization', authHeader());
    expect(r2.status).toBe(201);
  });
});

// ── DELETE /plants/:id/harvests/:harvestId ────────────────────────────────────

describe('DELETE /plants/:id/harvests/:harvestId', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/plants/p1/harvests/h1');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown plant', async () => {
    const res = await request(app)
      .delete('/plants/missing/harvests/h1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('removes the harvest entry and returns 200', async () => {
    store[plantPath('p1')] = {
      name: 'Tomato',
      harvestLog: [
        { id: 'h1', quantity: 1, unit: 'kg' },
        { id: 'h2', quantity: 2, unit: 'kg' },
      ],
    };
    const res = await request(app)
      .delete('/plants/p1/harvests/h1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(store[plantPath('p1')].harvestLog).toHaveLength(1);
    expect(store[plantPath('p1')].harvestLog[0].id).toBe('h2');
  });

  it('is idempotent — deleting a non-existent id still returns 200', async () => {
    store[plantPath('p1')] = { name: 'Tomato', harvestLog: [] };
    const res = await request(app)
      .delete('/plants/p1/harvests/nonexistent')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
  });
});

// ── QR short-code & scan routes ───────────────────────────────────────────────

describe('GET /plants/:id/short-code', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/plants/p1/short-code');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown plant', async () => {
    const res = await request(app)
      .get('/plants/missing/short-code')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  it('returns existing shortCode if present', async () => {
    store[plantPath('p1')] = { name: 'Monstera', shortCode: 'hp-abc12' };
    const res = await request(app)
      .get('/plants/p1/short-code')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.shortCode).toBe('hp-abc12');
    expect(res.body.plantId).toBe('p1');
  });

  it('generates and persists a shortCode if none exists', async () => {
    store[plantPath('p1')] = { name: 'Fern' };
    const res = await request(app)
      .get('/plants/p1/short-code')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.shortCode).toMatch(/^hp-[a-z0-9]{5}$/);
    expect(store[plantPath('p1')].shortCode).toBe(res.body.shortCode);
  });
});

describe('GET /scan/:shortCode', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/scan/hp-abc12');
    expect(res.status).toBe(401);
  });

  it('returns 404 when shortCode is not found', async () => {
    store[plantPath('p1')] = { name: 'Fern', shortCode: 'hp-other' };
    const res = await request(app)
      .get('/scan/hp-notfound')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('resolves a valid shortCode to the plant', async () => {
    store[plantPath('p1')] = { name: 'Monstera', species: 'Monstera deliciosa', shortCode: 'hp-abc12' };
    const res = await request(app)
      .get('/scan/hp-abc12')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.plantId).toBe('p1');
    expect(res.body.name).toBe('Monstera');
    expect(res.body.species).toBe('Monstera deliciosa');
  });
});

describe('POST /plants — shortCode generation', () => {
  it('assigns a shortCode on plant creation', async () => {
    const res = await request(app)
      .post('/plants')
      .send({ name: 'Tulip', species: 'Tulipa', frequencyDays: 7, lastWatered: '2026-01-01' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.shortCode).toMatch(/^hp-[a-z0-9]{5}$/);
  });
});

// ── Incident log ──────────────────────────────────────────────────────────────

describe('GET /plants/:id/incidents', () => {
  beforeEach(clearStore);

  it('returns empty array when no incidents', async () => {
    store[plantPath('p1')] = { species: 'Basil' };
    const res = await request(app).get('/plants/p1/incidents').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns incidents sorted newest first', async () => {
    const incidents = [
      { id: 'i1', category: 'pest', specificType: 'Aphids', firstObservedAt: '2026-01-01T00:00:00.000Z', resolvedAt: null, treatments: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'i2', category: 'disease', specificType: 'Powdery mildew', firstObservedAt: '2026-02-01T00:00:00.000Z', resolvedAt: null, treatments: [], createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' },
    ];
    store[plantPath('p1')] = { species: 'Basil', incidents };
    const res = await request(app).get('/plants/p1/incidents').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('i2');
    expect(res.body[1].id).toBe('i1');
  });

  it('returns 404 for unknown plant', async () => {
    const res = await request(app).get('/plants/nope/incidents').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('POST /plants/:id/incidents', () => {
  beforeEach(clearStore);

  it('creates an incident with valid fields', async () => {
    store[plantPath('p1')] = { species: 'Tomato', room: 'Greenhouse' };
    const res = await request(app).post('/plants/p1/incidents')
      .send({ category: 'pest', specificType: 'Spider mites', severity: 3, firstObservedAt: '2026-04-01T00:00:00.000Z' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.category).toBe('pest');
    expect(res.body.specificType).toBe('Spider mites');
    expect(res.body.severity).toBe(3);
    expect(res.body.outbreakId).toBeNull();
    expect(store[plantPath('p1')].incidents).toHaveLength(1);
  });

  it('rejects invalid category', async () => {
    store[plantPath('p1')] = { species: 'Tomato' };
    const res = await request(app).post('/plants/p1/incidents')
      .send({ category: 'alien', specificType: 'Something' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('rejects missing specificType', async () => {
    store[plantPath('p1')] = { species: 'Tomato' };
    const res = await request(app).post('/plants/p1/incidents')
      .send({ category: 'pest' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('rejects out-of-range severity', async () => {
    store[plantPath('p1')] = { species: 'Tomato' };
    const res = await request(app).post('/plants/p1/incidents')
      .send({ category: 'pest', specificType: 'Aphids', severity: 6 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('auto-groups outbreak when same room / same type within 14 days', async () => {
    const existingIncident = {
      id: 'i-existing', category: 'pest', specificType: 'Spider mites',
      firstObservedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      resolvedAt: null, treatments: [], outbreakId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    store[plantPath('p1')] = { species: 'Tomato', room: 'Greenhouse', incidents: [existingIncident] };
    store[plantPath('p2')] = { species: 'Basil', room: 'Greenhouse' };

    const res = await request(app).post('/plants/p2/incidents')
      .send({ category: 'pest', specificType: 'Spider mites', severity: 2 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.outbreakId).toBeTruthy();
    // The existing incident on p1 should also have been updated with the outbreakId
    const p1Incidents = store[plantPath('p1')].incidents;
    expect(p1Incidents[0].outbreakId).toBe(res.body.outbreakId);
  });

  it('does not group outbreak across different rooms', async () => {
    const existingIncident = {
      id: 'i-existing', category: 'pest', specificType: 'Aphids',
      firstObservedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      resolvedAt: null, treatments: [], outbreakId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    store[plantPath('p1')] = { species: 'Rose', room: 'Garden', incidents: [existingIncident] };
    store[plantPath('p2')] = { species: 'Fern', room: 'Kitchen' };

    const res = await request(app).post('/plants/p2/incidents')
      .send({ category: 'pest', specificType: 'Aphids', severity: 1 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.outbreakId).toBeNull();
  });

  it('does not group outbreak if existing incident is outside 14-day window', async () => {
    const existingIncident = {
      id: 'i-old', category: 'pest', specificType: 'Fungus gnats',
      firstObservedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      resolvedAt: null, treatments: [], outbreakId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    store[plantPath('p1')] = { species: 'Orchid', room: 'Bathroom', incidents: [existingIncident] };
    store[plantPath('p2')] = { species: 'Fern', room: 'Bathroom' };

    const res = await request(app).post('/plants/p2/incidents')
      .send({ category: 'pest', specificType: 'Fungus gnats' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.outbreakId).toBeNull();
  });
});

describe('PUT /plants/:id/incidents/:incidentId', () => {
  beforeEach(clearStore);

  it('updates severity and notes on an incident', async () => {
    const inc = { id: 'i1', category: 'pest', specificType: 'Aphids', severity: 2, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' };
    store[plantPath('p1')] = { species: 'Rosemary', incidents: [inc] };
    const res = await request(app).put('/plants/p1/incidents/i1')
      .send({ severity: 4, notes: 'Getting worse' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.severity).toBe(4);
    expect(res.body.notes).toBe('Getting worse');
  });

  it('returns 404 for unknown incident', async () => {
    store[plantPath('p1')] = { species: 'Basil', incidents: [] };
    const res = await request(app).put('/plants/p1/incidents/nope')
      .send({ severity: 3 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('POST /plants/:id/incidents/:incidentId/treatments', () => {
  beforeEach(clearStore);

  it('adds a treatment to an incident', async () => {
    const inc = { id: 'i1', category: 'disease', specificType: 'Powdery mildew', severity: 3, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' };
    store[plantPath('p1')] = { species: 'Squash', incidents: [inc] };
    const res = await request(app).post('/plants/p1/incidents/i1/treatments')
      .send({ treatment: 'Neem oil spray', outcome: 'Reduced spread' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.treatment).toBe('Neem oil spray');
    expect(res.body.outcome).toBe('Reduced spread');
    expect(store[plantPath('p1')].incidents[0].treatments).toHaveLength(1);
  });

  it('rejects missing treatment text', async () => {
    store[plantPath('p1')] = { species: 'Squash', incidents: [{ id: 'i1', category: 'pest', specificType: 'Aphids', treatments: [], resolvedAt: null }] };
    const res = await request(app).post('/plants/p1/incidents/i1/treatments')
      .send({})
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});

describe('POST /plants/:id/incidents/:incidentId/resolve', () => {
  beforeEach(clearStore);

  it('sets resolvedAt on the incident', async () => {
    const inc = { id: 'i1', category: 'pest', specificType: 'Aphids', resolvedAt: null, treatments: [], firstObservedAt: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' };
    store[plantPath('p1')] = { species: 'Basil', incidents: [inc] };
    const res = await request(app).post('/plants/p1/incidents/i1/resolve')
      .send({})
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.resolvedAt).toBeTruthy();
    expect(store[plantPath('p1')].incidents[0].resolvedAt).toBeTruthy();
  });
});

describe('DELETE /plants/:id/incidents/:incidentId', () => {
  beforeEach(clearStore);

  it('removes incident from the array', async () => {
    const inc = { id: 'i1', category: 'pest', specificType: 'Mealybugs', resolvedAt: null, treatments: [], firstObservedAt: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z' };
    store[plantPath('p1')] = { species: 'Cactus', incidents: [inc] };
    const res = await request(app).delete('/plants/p1/incidents/i1').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(store[plantPath('p1')].incidents).toHaveLength(0);
  });
});

describe('GET /outbreaks', () => {
  beforeEach(clearStore);

  it('returns empty array when no outbreaks', async () => {
    store[plantPath('p1')] = { species: 'Basil', incidents: [] };
    const res = await request(app).get('/outbreaks').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('groups linked incidents by outbreakId', async () => {
    const obId = 'ob-test-123';
    store[plantPath('p1')] = { name: 'Tomato', species: 'Tomato', room: 'Greenhouse', incidents: [
      { id: 'i1', category: 'pest', specificType: 'Spider mites', severity: 3, outbreakId: obId, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-10T00:00:00.000Z', createdAt: '2026-04-10T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
    ]};
    store[plantPath('p2')] = { name: 'Basil', species: 'Basil', room: 'Greenhouse', incidents: [
      { id: 'i2', category: 'pest', specificType: 'Spider mites', severity: 4, outbreakId: obId, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-12T00:00:00.000Z', createdAt: '2026-04-12T00:00:00.000Z', updatedAt: '2026-04-12T00:00:00.000Z' },
    ]};
    const res = await request(app).get('/outbreaks').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].outbreakId).toBe(obId);
    expect(res.body[0].plants).toHaveLength(2);
    expect(res.body[0].maxSeverity).toBe(4);
  });

  it('excludes resolved incidents from outbreaks', async () => {
    const obId = 'ob-resolved';
    store[plantPath('p1')] = { name: 'Fern', species: 'Fern', room: 'Hall', incidents: [
      { id: 'i1', category: 'disease', specificType: 'Root rot', outbreakId: obId, resolvedAt: '2026-04-15T00:00:00.000Z', treatments: [], firstObservedAt: '2026-04-01T00:00:00.000Z', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-15T00:00:00.000Z' },
    ]};
    const res = await request(app).get('/outbreaks').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /outbreaks/:outbreakId/resolve', () => {
  beforeEach(clearStore);

  it('resolves all open incidents in the outbreak across plants', async () => {
    const obId = 'ob-multi';
    store[plantPath('p1')] = { species: 'Mint', room: 'Kitchen', incidents: [
      { id: 'i1', category: 'pest', specificType: 'Whitefly', outbreakId: obId, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-10T00:00:00.000Z', createdAt: '2026-04-10T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
    ]};
    store[plantPath('p2')] = { species: 'Chives', room: 'Kitchen', incidents: [
      { id: 'i2', category: 'pest', specificType: 'Whitefly', outbreakId: obId, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-11T00:00:00.000Z', createdAt: '2026-04-11T00:00:00.000Z', updatedAt: '2026-04-11T00:00:00.000Z' },
    ]};
    const res = await request(app).post(`/outbreaks/${obId}/resolve`)
      .send({})
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(2);
    expect(store[plantPath('p1')].incidents[0].resolvedAt).toBeTruthy();
    expect(store[plantPath('p2')].incidents[0].resolvedAt).toBeTruthy();
  });
});

describe('POST /outbreaks/:outbreakId/treat', () => {
  beforeEach(clearStore);

  it('adds treatment to all open incidents in the outbreak', async () => {
    const obId = 'ob-treat';
    store[plantPath('p1')] = { species: 'Pepper', room: 'Garden', incidents: [
      { id: 'i1', category: 'pest', specificType: 'Aphids', outbreakId: obId, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-10T00:00:00.000Z', createdAt: '2026-04-10T00:00:00.000Z', updatedAt: '2026-04-10T00:00:00.000Z' },
    ]};
    store[plantPath('p2')] = { species: 'Cucumber', room: 'Garden', incidents: [
      { id: 'i2', category: 'pest', specificType: 'Aphids', outbreakId: obId, resolvedAt: null, treatments: [], firstObservedAt: '2026-04-11T00:00:00.000Z', createdAt: '2026-04-11T00:00:00.000Z', updatedAt: '2026-04-11T00:00:00.000Z' },
    ]};
    const res = await request(app).post(`/outbreaks/${obId}/treat`)
      .send({ treatment: 'Insecticidal soap' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(2);
    expect(res.body.treatment.treatment).toBe('Insecticidal soap');
    expect(store[plantPath('p1')].incidents[0].treatments).toHaveLength(1);
    expect(store[plantPath('p2')].incidents[0].treatments).toHaveLength(1);
  });

  it('rejects missing treatment text', async () => {
    const res = await request(app).post('/outbreaks/ob-x/treat')
      .send({})
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});

// ── Propagation tracker ───────────────────────────────────────────────────────

const propPath = id => `users/${USER_SUB}/propagations/${id}`;

describe('GET /propagations', () => {
  it('returns empty array when no propagations exist', async () => {
    const res = await request(app).get('/propagations').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns propagations sorted by startDate desc', async () => {
    store[propPath('p1')] = { method: 'seed', species: 'Tomato', startDate: '2026-04-01', status: 'sown' };
    store[propPath('p2')] = { method: 'cutting', species: 'Basil', startDate: '2026-04-10', status: 'rooted' };
    const res = await request(app).get('/propagations').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0].startDate).toBe('2026-04-10');
    expect(res.body[1].startDate).toBe('2026-04-01');
  });
});

describe('POST /propagations', () => {
  it('creates a seed propagation with status sown', async () => {
    const res = await request(app).post('/propagations')
      .send({ method: 'seed', species: 'Basil', batchSize: 6 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('sown');
    expect(res.body.batchSize).toBe(6);
  });

  it('creates a cutting propagation with status rooted', async () => {
    const res = await request(app).post('/propagations')
      .send({ method: 'cutting', species: 'Mint' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('rooted');
  });

  it('rejects unknown method', async () => {
    const res = await request(app).post('/propagations')
      .send({ method: 'magic', species: 'Fern' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('rejects missing species', async () => {
    const res = await request(app).post('/propagations')
      .send({ method: 'seed' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});

describe('PUT /propagations/:id', () => {
  it('advances status for seed (sown → germinated)', async () => {
    store[propPath('x1')] = { method: 'seed', species: 'Pepper', status: 'sown', batchSize: 3 };
    const res = await request(app).put('/propagations/x1')
      .send({ status: 'germinated' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('germinated');
  });

  it('rejects invalid status value', async () => {
    store[propPath('x2')] = { method: 'seed', species: 'Pepper', status: 'sown' };
    const res = await request(app).put('/propagations/x2')
      .send({ status: 'sprouted' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('rejects status not valid for method (germinated on cutting)', async () => {
    store[propPath('x3')] = { method: 'cutting', species: 'Mint', status: 'rooted' };
    const res = await request(app).put('/propagations/x3')
      .send({ status: 'germinated' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown propagation', async () => {
    const res = await request(app).put('/propagations/nope')
      .send({ status: 'ready' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('POST /propagations/:id/promote', () => {
  it('creates a new plant with lineage link and marks propagation transplanted', async () => {
    store[propPath('pr1')] = {
      method: 'cutting', species: 'Mint', status: 'ready', batchSize: 2,
      parentPlantId: null, startDate: '2026-04-01',
    };
    const res = await request(app).post('/propagations/pr1/promote')
      .send({ name: 'Kitchen Mint', room: 'Kitchen', count: 1 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.promoted).toHaveLength(1);
    expect(res.body.promoted[0].parentPropagationId).toBe('pr1');
    expect(res.body.promoted[0].species).toBe('Mint');
    expect(store[propPath('pr1')].status).toBe('transplanted');
  });

  it('creates multiple plants when count > 1', async () => {
    store[propPath('pr2')] = {
      method: 'seed', species: 'Tomato', status: 'ready', batchSize: 4, parentPlantId: null,
    };
    const res = await request(app).post('/propagations/pr2/promote')
      .send({ name: 'Tomato', count: 3 })
      .set('Authorization', authHeader());
    expect(res.status).toBe(201);
    expect(res.body.promoted).toHaveLength(3);
    expect(res.body.promoted[0].name).toBe('Tomato 1');
    expect(res.body.promoted[2].name).toBe('Tomato 3');
  });

  it('rejects promote without name', async () => {
    store[propPath('pr3')] = { method: 'seed', species: 'Basil', status: 'ready', batchSize: 1 };
    const res = await request(app).post('/propagations/pr3/promote')
      .send({})
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown propagation', async () => {
    const res = await request(app).post('/propagations/nope/promote')
      .send({ name: 'Plant' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

describe('DELETE /propagations/:id', () => {
  it('deletes an existing propagation', async () => {
    store[propPath('d1')] = { method: 'seed', species: 'Basil', status: 'sown' };
    const res = await request(app).delete('/propagations/d1').set('Authorization', authHeader());
    expect(res.status).toBe(204);
    expect(store[propPath('d1')]).toBeUndefined();
  });

  it('returns 404 for unknown propagation', async () => {
    const res = await request(app).delete('/propagations/nope').set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Export routes
// ---------------------------------------------------------------------------

describe('GET /export/plants', () => {
  beforeEach(() => {
    store[plantPath('e1')] = { name: 'Basil', species: 'Ocimum basilicum', room: 'Kitchen', health: 'good', frequencyDays: 3, lastWatered: '2026-04-18' };
    store[plantPath('e2')] = { name: 'Fern, "Boston"', species: 'Nephrolepis', room: 'Bathroom', health: 'fair', frequencyDays: 7, lastWatered: '2026-04-10' };
  });

  it('returns JSON list of plants without format param', async () => {
    const res = await request(app).get('/export/plants').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  it('returns CSV with correct Content-Type for ?format=csv', async () => {
    const res = await request(app).get('/export/plants?format=csv').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('CSV escapes commas and quotes in field values', async () => {
    const res = await request(app).get('/export/plants?format=csv').set('Authorization', authHeader());
    expect(res.text).toContain('"Fern, ""Boston"""');
  });

  it('CSV includes all plants as rows (header + 2 data rows)', async () => {
    const res = await request(app).get('/export/plants?format=csv').set('Authorization', authHeader());
    const lines = res.text.trim().split('\n');
    expect(lines.length).toBe(3);
  });
});

describe('GET /export/watering-history', () => {
  beforeEach(() => {
    store[plantPath('w1')] = {
      name: 'Aloe', species: 'Aloe vera', room: 'Living Room',
      wateringLog: [
        { date: '2026-04-15', method: 'bottom', amount: '200ml', notes: '' },
        { date: '2026-04-08', method: 'top',    amount: '150ml', notes: 'extra' },
      ],
    };
    store[plantPath('w2')] = {
      name: 'Cactus', species: 'Cactaceae', room: 'Study',
      wateringLog: [
        { date: '2026-04-12', method: 'top', amount: '50ml', notes: '' },
      ],
    };
  });

  it('returns JSON array of watering rows', async () => {
    const res = await request(app).get('/export/watering-history').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });

  it('CSV rows are sorted by date ascending', async () => {
    const res = await request(app).get('/export/watering-history?format=csv').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    const lines = res.text.trim().split('\n');
    expect(lines[1]).toContain('2026-04-08');
    expect(lines[3]).toContain('2026-04-15');
  });

  it('filters rows by ?from date', async () => {
    const res = await request(app).get('/export/watering-history?from=2026-04-12').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.every(r => r.date >= '2026-04-12')).toBe(true);
  });
});

describe('GET /export/care-schedule', () => {
  beforeEach(() => {
    store[plantPath('c1')] = { name: 'Mint', species: 'Mentha', room: 'Kitchen', frequencyDays: 2, lastWatered: '2026-04-19', health: 'good' };
    store[plantPath('c2')] = { name: 'Snake Plant', species: 'Sansevieria', room: 'Bedroom', frequencyDays: 14, lastWatered: '2026-04-01', health: 'excellent' };
  });

  it('returns HTML with a care-schedule table', async () => {
    const res = await request(app).get('/export/care-schedule').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<table>');
    expect(res.text).toContain('Mint');
    expect(res.text).toContain('Snake Plant');
  });

  it('sets Content-Disposition attachment header when ?format=html', async () => {
    const res = await request(app).get('/export/care-schedule?format=html').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.html/);
  });
});
