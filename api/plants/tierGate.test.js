import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createTierGate } = require('./tierGate');

// Lightweight db stub — just what billing.getCurrentTier / counter functions need.
function makeDb(store = {}) {
  function makeColl(prefix) {
    return {
      doc(id) {
        const path = `${prefix}/${id}`;
        return {
          id,
          get: async () => ({ exists: store[path] !== undefined, id, data: () => store[path] }),
          set: async (d, o) => {
            store[path] = (o?.merge && store[path]) ? { ...store[path], ...d } : { ...d };
          },
          collection: (sub) => makeColl(`${path}/${sub}`),
        };
      },
      get: async () => ({
        docs: Object.entries(store)
          .filter(([k]) => k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes('/'))
          .map(([k, v]) => ({ id: k.slice(prefix.length + 1), data: () => v })),
      }),
    };
  }
  return { collection: (n) => makeColl(n) };
}

function runMiddleware(mw, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      payload:    null,
      status(code) { this.statusCode = code; return this; },
      json(p) { this.payload = p; resolve({ next: false, res: this, req }); },
    };
    mw(req, res, () => resolve({ next: true, res, req }));
  });
}

describe('requireTier', () => {
  beforeEach(() => { delete process.env.BILLING_ENABLED; });

  it('no-ops when billing is disabled', async () => {
    const { requireTier } = createTierGate(makeDb());
    const r = await runMiddleware(requireTier('home_pro'), { userId: 'u1' });
    expect(r.next).toBe(true);
    expect(r.req.userTier).toBe('free');
  });

  it('403s when current tier is below the required tier', async () => {
    process.env.BILLING_ENABLED = 'true';
    const { requireTier } = createTierGate(makeDb());
    const r = await runMiddleware(requireTier('home_pro'), { userId: 'u1' });
    expect(r.next).toBe(false);
    expect(r.res.statusCode).toBe(403);
    expect(r.res.payload.error).toBe('upgrade_required');
    expect(r.res.payload.requiredTier).toBe('home_pro');
    expect(r.res.payload.currentTier).toBe('free');
  });

  it('passes when the user is on or above the required tier', async () => {
    process.env.BILLING_ENABLED = 'true';
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'active' } });
    const { requireTier } = createTierGate(db);
    const r = await runMiddleware(requireTier('home_pro'), { userId: 'u1' });
    expect(r.next).toBe(true);
    expect(r.req.userTier).toBe('home_pro');
  });
});

describe('checkQuota', () => {
  beforeEach(() => { delete process.env.BILLING_ENABLED; });

  it('no-ops when billing is disabled', async () => {
    const { checkQuota } = createTierGate(makeDb());
    const counter = async () => 999;
    const r = await runMiddleware(checkQuota('plants', counter), { userId: 'u1' });
    expect(r.next).toBe(true);
  });

  it('no-ops when userId is missing (anonymous request)', async () => {
    process.env.BILLING_ENABLED = 'true';
    const { checkQuota } = createTierGate(makeDb());
    const counter = async () => 20;
    const r = await runMiddleware(checkQuota('plants', counter), {});
    expect(r.next).toBe(true);
  });

  it('blocks with 429 when usage meets the limit', async () => {
    process.env.BILLING_ENABLED = 'true';
    const { checkQuota } = createTierGate(makeDb());
    const counter = async () => 10; // free tier plants limit is 10
    const r = await runMiddleware(checkQuota('plants', counter), { userId: 'u1' });
    expect(r.next).toBe(false);
    expect(r.res.statusCode).toBe(429);
    expect(r.res.payload.error).toBe('quota_exceeded');
    expect(r.res.payload.quotaType).toBe('plants');
    expect(r.res.payload.limit).toBe(10);
    expect(r.res.payload.current).toBe(10);
  });

  it('passes when usage is below limit and exposes currentQuota', async () => {
    process.env.BILLING_ENABLED = 'true';
    const { checkQuota } = createTierGate(makeDb());
    const counter = async () => 4;
    const r = await runMiddleware(checkQuota('plants', counter), { userId: 'u1' });
    expect(r.next).toBe(true);
    expect(r.req.currentQuota).toEqual({ quotaType: 'plants', limit: 10, current: 4 });
  });

  it('always passes when the tier has an Infinity quota', async () => {
    process.env.BILLING_ENABLED = 'true';
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'active' } });
    const { checkQuota } = createTierGate(db);
    const counter = async () => 1_000_000;
    const r = await runMiddleware(checkQuota('plants', counter), { userId: 'u1' });
    expect(r.next).toBe(true);
  });
});
