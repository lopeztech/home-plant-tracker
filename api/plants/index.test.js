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
          return { file: function(_f) { return { getSignedUrl: function() { return storageSignedUrlFn.apply(this, arguments); } }; } };
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
  clearStore();
  geminiGenerateFn = async () => { throw new Error('geminiGenerateFn not configured'); };
  storageSignedUrlFn = async () => ['https://signed.example.com/img.jpg'];
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
  it('returns 400 when filename is missing', async () => {
    const res = await request(app).post('/images/upload-url').send({ contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when contentType is missing', async () => {
    const res = await request(app).post('/images/upload-url').send({ filename: 'plants/img.jpg' });
    expect(res.status).toBe(400);
  });

  it('returns uploadUrl and publicUrl', async () => {
    storageSignedUrlFn = async () => ['https://storage.googleapis.com/bucket/plants/img.jpg?token=xyz'];
    const res = await request(app).post('/images/upload-url').send({ filename: 'plants/img.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe('https://storage.googleapis.com/bucket/plants/img.jpg?token=xyz');
    expect(res.body.publicUrl).toContain('plants/img.jpg');
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
});
