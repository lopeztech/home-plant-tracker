import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const billing = require('./billing');

// In-memory Firestore stub matching the shape used by billing.js
function makeDb(store = {}) {
  function makeColl(prefix) {
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
          collection: (sub) => makeColl(`${path}/${sub}`),
        };
      },
      get: async () => {
        const pfx = `${prefix}/`;
        const docs = Object.entries(store)
          .filter(([k]) => k.startsWith(pfx) && !k.slice(pfx.length).includes('/'))
          .map(([k, v]) => ({ id: k.slice(pfx.length), data: () => v }));
        return { docs };
      },
    };
  }
  return {
    _store: store,
    collection: (name) => makeColl(name),
  };
}

describe('billing.billingEnabled', () => {
  beforeEach(() => { delete process.env.BILLING_ENABLED; });

  it('returns false when unset', () => {
    expect(billing.billingEnabled()).toBe(false);
  });

  it('returns true only when exactly "true"', () => {
    process.env.BILLING_ENABLED = 'true';
    expect(billing.billingEnabled()).toBe(true);
    process.env.BILLING_ENABLED = 'yes';
    expect(billing.billingEnabled()).toBe(false);
  });
});

describe('billing.tierMeetsMinimum', () => {
  it('treats tiers as an ordered hierarchy', () => {
    expect(billing.tierMeetsMinimum('free',           'free')).toBe(true);
    expect(billing.tierMeetsMinimum('home_pro',       'free')).toBe(true);
    expect(billing.tierMeetsMinimum('landscaper_pro', 'home_pro')).toBe(true);
    expect(billing.tierMeetsMinimum('free',           'home_pro')).toBe(false);
    expect(billing.tierMeetsMinimum('home_pro',       'landscaper_pro')).toBe(false);
  });

  it('returns false for unknown tier names', () => {
    expect(billing.tierMeetsMinimum('mystery', 'free')).toBe(false);
  });
});

describe('billing.tierQuota', () => {
  it('returns the numeric limit for free tier plants (10)', () => {
    expect(billing.tierQuota('free', 'plants')).toBe(10);
  });
  it('returns Infinity for home_pro unlimited quotas', () => {
    expect(billing.tierQuota('home_pro', 'plants')).toBe(Infinity);
    expect(billing.tierQuota('home_pro', 'ai_analyses')).toBe(Infinity);
  });
  it('returns 0 for unknown quota types', () => {
    expect(billing.tierQuota('free', 'unknown_quota')).toBe(0);
  });
});

describe('billing.getCurrentTier', () => {
  beforeEach(() => { process.env.BILLING_ENABLED = 'true'; });

  it('returns free when billing is disabled regardless of subscription', async () => {
    process.env.BILLING_ENABLED = 'false';
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'active' } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('free');
  });

  it('returns free when there is no subscription doc', async () => {
    const db = makeDb();
    expect(await billing.getCurrentTier(db, 'u1')).toBe('free');
  });

  it('returns the stored tier when subscription is active', async () => {
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'active' } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('home_pro');
  });

  it('returns the stored tier when trialing', async () => {
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'landscaper_pro', status: 'trialing' } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('landscaper_pro');
  });

  it('drops to free when subscription is cancelled', async () => {
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'canceled' } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('free');
  });

  it('honours a 7-day grace window when past_due inside the window', async () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'past_due', currentPeriodEnd: soon } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('home_pro');
  });

  it('drops to free when past_due and grace window elapsed', async () => {
    const long = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'home_pro', status: 'past_due', currentPeriodEnd: long } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('free');
  });

  it('returns free when the stored tier is unknown', async () => {
    const db = makeDb({ 'users/u1/subscription/current': { tier: 'enterprise', status: 'active' } });
    expect(await billing.getCurrentTier(db, 'u1')).toBe('free');
  });
});

describe('billing.applySubscriptionEvent', () => {
  beforeEach(() => { process.env.BILLING_ENABLED = 'true'; });

  it('writes a subscription doc and customer map on checkout.session.completed', async () => {
    const db = makeDb();
    await billing.applySubscriptionEvent(db, {
      type: 'checkout.session.completed',
      data: { object: {
        client_reference_id: 'u1',
        customer: 'cus_test',
        subscription: 'sub_test',
        metadata: { tier: 'home_pro' },
      }},
    });
    expect(db._store['users/u1/subscription/current']).toMatchObject({
      tier: 'home_pro', status: 'active', stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test',
    });
    expect(db._store['stripeCustomers/cus_test']).toMatchObject({ userId: 'u1' });
  });

  it('updates status/current period on customer.subscription.updated via the customer map', async () => {
    const db = makeDb({
      'stripeCustomers/cus_test': { userId: 'u1' },
      'users/u1/subscription/current': { tier: 'home_pro', status: 'active', stripeCustomerId: 'cus_test' },
    });
    await billing.applySubscriptionEvent(db, {
      type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_test', customer: 'cus_test', status: 'active',
        current_period_end: 1_800_000_000, cancel_at_period_end: true,
        metadata: { tier: 'home_pro' },
      }},
    });
    const s = db._store['users/u1/subscription/current'];
    expect(s.status).toBe('active');
    expect(s.cancelAtPeriodEnd).toBe(true);
    expect(s.currentPeriodEnd).toMatch(/^20\d\d-/);
  });

  it('marks status canceled on customer.subscription.deleted', async () => {
    const db = makeDb({
      'stripeCustomers/cus_test': { userId: 'u1' },
      'users/u1/subscription/current': { tier: 'home_pro', status: 'active', stripeCustomerId: 'cus_test' },
    });
    await billing.applySubscriptionEvent(db, {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_test', customer: 'cus_test', status: 'canceled' } },
    });
    expect(db._store['users/u1/subscription/current'].status).toBe('canceled');
  });

  it('flips status to past_due on invoice.payment_failed', async () => {
    const db = makeDb({
      'stripeCustomers/cus_test': { userId: 'u1' },
      'users/u1/subscription/current': { tier: 'home_pro', status: 'active', stripeCustomerId: 'cus_test' },
    });
    await billing.applySubscriptionEvent(db, {
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_test' } },
    });
    expect(db._store['users/u1/subscription/current'].status).toBe('past_due');
  });

  it('swallows events with an unknown customer', async () => {
    const db = makeDb();
    await expect(billing.applySubscriptionEvent(db, {
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test', customer: 'cus_unknown', status: 'active' } },
    })).resolves.toBeUndefined();
  });
});

describe('billing.countPlants + ai_analyses usage', () => {
  it('counts plants under users/{uid}/plants', async () => {
    const db = makeDb({
      'users/u1/plants/p1': { name: 'A' },
      'users/u1/plants/p2': { name: 'B' },
      'users/u2/plants/p3': { name: 'C' },
    });
    expect(await billing.countPlants(db, 'u1')).toBe(2);
    expect(await billing.countPlants(db, 'u2')).toBe(1);
    expect(await billing.countPlants(db, 'uX')).toBe(0);
  });

  it('increments aiAnalyses monthly counter', async () => {
    const db = makeDb();
    expect(await billing.incrementAiAnalyses(db, 'u1')).toBe(1);
    expect(await billing.incrementAiAnalyses(db, 'u1')).toBe(2);
    expect(await billing.readAiAnalysesUsage(db, 'u1')).toBe(2);
  });
});
