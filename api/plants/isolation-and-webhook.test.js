// Integration-level tests for the Express app covering two production-critical
// concerns the rest of the suite doesn't exercise:
//
//   Part A — Cross-user data isolation. Every Firestore read/write must scope
//            by req.userId so userA cannot read, mutate, or delete userB's
//            data through any endpoint. `firestore.rules` is deny-all, so the
//            backend is the security boundary.
//
//   Part B — Stripe webhook plumbing. Signature verification, event.id
//            idempotency (Stripe retries), and the BILLING_ENABLED dark-ship
//            switch. The business logic in applySubscriptionEvent() is
//            already covered by billing.test.js — here we verify the HTTP
//            handler calls it correctly and exactly once per event.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const request = require('supertest');
const proxyquire = require('proxyquire').noCallThru();
const crypto = require('crypto');

// ── In-memory Firestore store (same shape as index.test.js) ─────────────────

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
        get: async () => ({ exists: store[path] !== undefined, id, data: () => store[path] }),
        set: async (data, opts) => {
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
    orderBy: (field, dir) => {
      let _limit = null;
      let _startAfter = null;
      const _dir = dir || 'asc';
      function execGet() {
        const pfx = `${prefix}/`;
        const entries = Object.entries(store)
          .filter(([k]) => k.startsWith(pfx) && !k.slice(pfx.length).includes('/'))
          .map(([k, v]) => ({ id: k.slice(pfx.length), data: () => v }));
        entries.sort((a, b) => {
          const av = a.data()[field] != null ? a.data()[field] : '';
          const bv = b.data()[field] != null ? b.data()[field] : '';
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return _dir === 'desc' ? -cmp : cmp;
        });
        let result = entries;
        if (_startAfter !== null) {
          const idx = result.findIndex(e => e.data()[field] === _startAfter);
          result = idx >= 0 ? result.slice(idx + 1) : result;
        }
        if (_limit !== null) result = result.slice(0, _limit);
        return Promise.resolve({ docs: result.map(e => ({ id: e.id, data: e.data })) });
      }
      return {
        get: () => execGet(),
        limit(n) { _limit = n; return this; },
        startAfter(val) { _startAfter = val; return this; },
      };
    },
  };
}

// ── Per-test mocks for Stripe-adjacent calls ────────────────────────────────

let stripeConstructEventFn;     // stripe.webhooks.constructEvent
let applySubscriptionEventFn;   // billing.applySubscriptionEvent
let getStripeResult;            // value returned by billing.getStripe()

// ── Load the Express app once via proxyquire ────────────────────────────────
// We keep the REAL billing module (so tierMeetsMinimum/getCurrentTier etc.
// behave normally) and only override getStripe + applySubscriptionEvent so
// the webhook tests can drive those two seams.

const realBilling = require('./billing');

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
          return { generateContent: async () => ({ response: { text: () => '{}' } }) };
        }
      },
      SchemaType: { OBJECT: 'OBJECT', ARRAY: 'ARRAY', STRING: 'STRING', INTEGER: 'INTEGER' },
    },
    '@google-cloud/storage': {
      Storage: class {
        bucket() {
          return {
            file: () => ({
              getSignedUrl: async () => ['https://signed.example.com/img.jpg'],
              delete: async () => {},
              save: async () => {},
            }),
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
      checkStatus: async () => ({ status: 'ok', project: 'test', location: 'us-central1', endpointCount: 0 }),
      predict: async () => [],
      batchPredict: async () => ({}),
    },
    'jsonrepair': { jsonrepair: s => s },
    './billing': {
      ...realBilling,
      getStripe: () => getStripeResult,
      applySubscriptionEvent: (...args) => applySubscriptionEventFn(...args),
    },
  });
});

beforeEach(() => {
  clearStore();
  stripeConstructEventFn = () => { throw new Error('stripeConstructEventFn not configured'); };
  applySubscriptionEventFn = async () => { /* no-op default */ };
  getStripeResult = null;
});

// ── Auth helpers ────────────────────────────────────────────────────────────

function authHeader(sub) {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64');
  return `Bearer h.${payload}.s`;
}

const USER_A = 'user-a';
const USER_B = 'user-b';

// Seed helper — puts a plant into the store under the given user.
function seedPlant(userId, plantId, overrides = {}) {
  store[`users/${userId}/plants/${plantId}`] = {
    name: `${userId}-plant`,
    species: 'Test sp.',
    frequencyDays: 7,
    lastWatered: '2026-04-20T00:00:00.000Z',
    shortCode: `SC-${plantId}`,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Part A — Cross-user data isolation
// ════════════════════════════════════════════════════════════════════════════

describe('User isolation — userA cannot access userB data', () => {
  const PLANT_A = 'plant-a1';
  const PLANT_B = 'plant-b1';

  beforeEach(() => {
    seedPlant(USER_A, PLANT_A, { name: 'Aloe' });
    seedPlant(USER_B, PLANT_B, { name: 'Basil' });
  });

  it('GET /plants as userA returns only userA plants', async () => {
    // GET /plants without pagination params returns a flat array (legacy shape).
    const res = await request(app).get('/plants').set('Authorization', authHeader(USER_A));
    expect(res.status).toBe(200);
    const ids = res.body.map(p => p.id);
    expect(ids).toContain(PLANT_A);
    expect(ids).not.toContain(PLANT_B);
  });

  it('GET /plants/:id as userA returns 404 for userB plant (no data leak)', async () => {
    const res = await request(app).get(`/plants/${PLANT_B}`).set('Authorization', authHeader(USER_A));
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('name');
  });

  it('PUT /plants/:id as userA cannot modify userB plant', async () => {
    const res = await request(app)
      .put(`/plants/${PLANT_B}`)
      .set('Authorization', authHeader(USER_A))
      .send({ name: 'hijacked' });
    expect(res.status).toBe(404);
    expect(store[`users/${USER_B}/plants/${PLANT_B}`].name).toBe('Basil');
  });

  it('DELETE /plants/:id as userA cannot delete userB plant', async () => {
    const res = await request(app).delete(`/plants/${PLANT_B}`).set('Authorization', authHeader(USER_A));
    expect(res.status).toBe(404);
    expect(store[`users/${USER_B}/plants/${PLANT_B}`]).toBeDefined();
  });

  it('POST /plants/:id/water as userA returns 404 on userB plant and logs nothing', async () => {
    const res = await request(app)
      .post(`/plants/${PLANT_B}/water`)
      .set('Authorization', authHeader(USER_A))
      .send({ method: 'top' });
    expect(res.status).toBe(404);
    expect(store[`users/${USER_B}/plants/${PLANT_B}`].wateringLog).toBeUndefined();
  });

  it('POST /plants/:id/journal as userA cannot append to userB plant journal', async () => {
    const res = await request(app)
      .post(`/plants/${PLANT_B}/journal`)
      .set('Authorization', authHeader(USER_A))
      .send({ note: 'intrusion' });
    expect(res.status).toBe(404);
  });

  it('GET /scan/:shortCode returns 404 when shortCode belongs to another user', async () => {
    // userB's shortCode is SC-plant-b1; userA scanning it must NOT resolve
    const res = await request(app).get(`/scan/SC-${PLANT_B}`).set('Authorization', authHeader(USER_A));
    expect(res.status).toBe(404);
  });

  it('GET /config/floors returns only the caller user\'s floors config', async () => {
    store[`users/${USER_A}/config/floors`] = { floors: [{ id: 'f-a', name: 'UserA floor' }] };
    store[`users/${USER_B}/config/floors`] = { floors: [{ id: 'f-b', name: 'UserB floor' }] };

    const resA = await request(app).get('/config/floors').set('Authorization', authHeader(USER_A));
    expect(resA.status).toBe(200);
    expect(JSON.stringify(resA.body)).toContain('UserA floor');
    expect(JSON.stringify(resA.body)).not.toContain('UserB floor');

    const resB = await request(app).get('/config/floors').set('Authorization', authHeader(USER_B));
    expect(resB.status).toBe(200);
    expect(JSON.stringify(resB.body)).toContain('UserB floor');
    expect(JSON.stringify(resB.body)).not.toContain('UserA floor');
  });

  it('Public API: userA-owned x-plant-api-key cannot access userB plant', async () => {
    // Seed the apiKeyHashes lookup that requireApiKey uses.
    const rawKey = 'pt_test_userA_key_abc123';
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    store[`apiKeyHashes/${hash}`] = { userId: USER_A, revokedAt: null, createdAt: '2026-01-01T00:00:00.000Z' };

    const res = await request(app)
      .get(`/api/v1/plants/${PLANT_B}`)
      .set('x-plant-api-key', rawKey);
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Part B — Stripe webhook signature + idempotency + dark-ship
// ════════════════════════════════════════════════════════════════════════════

describe('POST /billing/webhook', () => {
  // Helper: build a fake stripe client whose constructEvent is driven by
  // stripeConstructEventFn, matching the shape billing.getStripe() returns.
  function fakeStripe() {
    return {
      webhooks: {
        constructEvent: (...args) => stripeConstructEventFn(...args),
      },
    };
  }

  describe('dark-ship (BILLING_ENABLED=false or stripe not configured)', () => {
    it('returns 503 when getStripe() returns null (billing disabled)', async () => {
      getStripeResult = null;
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

      const res = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 'anything')
        .set('Content-Type', 'application/json')
        .send({ type: 'checkout.session.completed' });

      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'billing_disabled' });
    });

    it('returns 503 when STRIPE_WEBHOOK_SECRET is unset (even if stripe configured)', async () => {
      getStripeResult = fakeStripe();
      delete process.env.STRIPE_WEBHOOK_SECRET;

      const res = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 'anything')
        .set('Content-Type', 'application/json')
        .send({ type: 'checkout.session.completed' });

      expect(res.status).toBe(503);
    });
  });

  describe('signature verification', () => {
    beforeEach(() => {
      getStripeResult = fakeStripe();
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    it('returns 400 when stripe.webhooks.constructEvent throws (bad signature)', async () => {
      stripeConstructEventFn = () => { throw new Error('No signatures found matching the expected signature for payload.'); };
      const applySpy = vi.fn(async () => {});
      applySubscriptionEventFn = applySpy;

      const res = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 'forged_sig')
        .set('Content-Type', 'application/json')
        .send({ type: 'checkout.session.completed' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature verification failed/i);
      expect(applySpy).not.toHaveBeenCalled();
      // No stripeEvents doc written for rejected payloads
      const stripeEventsWritten = Object.keys(store).filter(k => k.startsWith('stripeEvents/'));
      expect(stripeEventsWritten).toEqual([]);
    });

    it('accepts a validly-signed event and calls applySubscriptionEvent exactly once', async () => {
      const event = { id: 'evt_good_1', type: 'checkout.session.completed', data: { object: {} } };
      stripeConstructEventFn = () => event;
      const applySpy = vi.fn(async () => {});
      applySubscriptionEventFn = applySpy;

      const res = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 't=123,v1=abc')
        .set('Content-Type', 'application/json')
        .send({ type: 'checkout.session.completed' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(applySpy.mock.calls[0][1]).toEqual(event);
      expect(store['stripeEvents/evt_good_1']).toMatchObject({ type: 'checkout.session.completed' });
    });
  });

  describe('idempotency via stripeEvents/{event.id}', () => {
    beforeEach(() => {
      getStripeResult = fakeStripe();
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    });

    it('second delivery of the same event.id is a no-op with duplicate flag', async () => {
      const event = { id: 'evt_dup_1', type: 'customer.subscription.updated', data: { object: {} } };
      stripeConstructEventFn = () => event;
      const applySpy = vi.fn(async () => {});
      applySubscriptionEventFn = applySpy;

      const first = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 't=1,v1=a')
        .set('Content-Type', 'application/json')
        .send({});
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ received: true });

      const second = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 't=1,v1=a')
        .set('Content-Type', 'application/json')
        .send({});
      expect(second.status).toBe(200);
      expect(second.body).toEqual({ received: true, duplicate: true });

      // The business logic must run exactly once across both deliveries
      expect(applySpy).toHaveBeenCalledTimes(1);
    });

    it('different event.ids are both applied', async () => {
      const applySpy = vi.fn(async () => {});
      applySubscriptionEventFn = applySpy;

      for (const id of ['evt_a', 'evt_b']) {
        stripeConstructEventFn = () => ({ id, type: 'invoice.payment_succeeded', data: { object: {} } });
        const res = await request(app)
          .post('/billing/webhook')
          .set('stripe-signature', 't=1,v1=a')
          .set('Content-Type', 'application/json')
          .send({});
        expect(res.status).toBe(200);
      }
      expect(applySpy).toHaveBeenCalledTimes(2);
      expect(store['stripeEvents/evt_a']).toBeDefined();
      expect(store['stripeEvents/evt_b']).toBeDefined();
    });

    it('surfaces 500 when applySubscriptionEvent throws, but event is still recorded', async () => {
      stripeConstructEventFn = () => ({ id: 'evt_err_1', type: 'customer.subscription.deleted', data: { object: {} } });
      applySubscriptionEventFn = async () => { throw new Error('firestore write failed'); };

      const res = await request(app)
        .post('/billing/webhook')
        .set('stripe-signature', 't=1,v1=a')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/firestore write failed/);
      // Event is marked seen — Stripe will retry, which is the intended behavior;
      // the duplicate guard will then short-circuit. This test documents that
      // contract so future refactors don't accidentally un-record failed events.
      expect(store['stripeEvents/evt_err_1']).toBeDefined();
    });
  });
});
