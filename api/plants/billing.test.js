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

describe('billing add-ons (#411)', () => {
  beforeEach(() => {
    process.env.BILLING_ENABLED = 'true';
    process.env.STRIPE_PRICE_FAMILY_MONTHLY = 'price_fam_m';
    process.env.STRIPE_PRICE_FAMILY_ANNUAL  = 'price_fam_y';
  });

  it('exposes the family add-on definition with home_pro applicability', () => {
    expect(billing.ADDONS.family).toMatchObject({
      appliesTo: ['home_pro'],
      quotaOverrides: { household_members: 5 },
    });
  });

  it('parseAddonsMetadata splits a comma-separated metadata string', () => {
    expect(billing.parseAddonsMetadata('family')).toEqual({ family: true });
    expect(billing.parseAddonsMetadata('family,foo')).toEqual({ family: true, foo: true });
    expect(billing.parseAddonsMetadata('')).toBeNull();
    expect(billing.parseAddonsMetadata(null)).toBeNull();
  });

  it('deriveAddonsFromItems matches Stripe items against ADDONS priceEnv', () => {
    const items = [{ price: { id: 'price_home_pro' } }, { price: { id: 'price_fam_m' } }];
    expect(billing.deriveAddonsFromItems(items)).toEqual({ family: true });
  });

  it('getActiveAddons returns family when stored and tier is home_pro', async () => {
    const db = makeDb({
      'users/u1/subscription/current': {
        tier: 'home_pro', status: 'active', addons: { family: true },
      },
    });
    expect(await billing.getActiveAddons(db, 'u1')).toEqual(['family']);
    expect(await billing.hasAddon(db, 'u1', 'family')).toBe(true);
  });

  it('getActiveAddons filters out addons whose appliesTo no longer matches', async () => {
    // User cancelled home_pro → tier resolves to free, family should not leak.
    const db = makeDb({
      'users/u1/subscription/current': {
        tier: 'home_pro', status: 'canceled', addons: { family: true },
      },
    });
    expect(await billing.getActiveAddons(db, 'u1')).toEqual([]);
  });

  it('getActiveAddons is empty when billing is disabled', async () => {
    process.env.BILLING_ENABLED = 'false';
    const db = makeDb({
      'users/u1/subscription/current': {
        tier: 'home_pro', status: 'active', addons: { family: true },
      },
    });
    expect(await billing.getActiveAddons(db, 'u1')).toEqual([]);
  });

  it('effectiveQuotas lifts household_members from 1 to 5 with family add-on', () => {
    expect(billing.effectiveQuotas('home_pro').household_members).toBe(1);
    expect(billing.effectiveQuotas('home_pro', ['family']).household_members).toBe(5);
  });

  it('effectiveQuotas never reduces a quota below the tier baseline', () => {
    // landscaper_pro baseline is 10 — family addon's 5 must NOT override down.
    const q = billing.effectiveQuotas('landscaper_pro', ['family']);
    expect(q.household_members).toBe(10);
  });

  it('applySubscriptionEvent persists addons from checkout metadata', async () => {
    const db = makeDb();
    await billing.applySubscriptionEvent(db, {
      type: 'checkout.session.completed',
      data: { object: {
        client_reference_id: 'u1', customer: 'cus_test', subscription: 'sub_test',
        metadata: { tier: 'home_pro', addons: 'family' },
      }},
    });
    expect(db._store['users/u1/subscription/current'].addons).toEqual({ family: true });
  });

  it('applySubscriptionEvent re-derives addons from live subscription items', async () => {
    const db = makeDb({
      'stripeCustomers/cus_test': { userId: 'u1' },
      'users/u1/subscription/current': { tier: 'home_pro', status: 'active', stripeCustomerId: 'cus_test' },
    });
    await billing.applySubscriptionEvent(db, {
      type: 'customer.subscription.updated',
      data: { object: {
        id: 'sub_test', customer: 'cus_test', status: 'active',
        items: { data: [{ price: { id: 'price_home_pro' } }, { price: { id: 'price_fam_m' } }] },
      }},
    });
    expect(db._store['users/u1/subscription/current'].addons).toEqual({ family: true });
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
