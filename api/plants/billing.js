'use strict';

// ── Tier definitions ─────────────────────────────────────────────────────────
// Limits match the tables in issues #156 and #157. Use Infinity for "no cap".

const TIERS = {
  free: {
    level: 0,
    quotas: {
      plants:            10,
      ai_analyses:       5,    // per calendar month
      photo_storage_mb:  50,
      properties:        1,
      team_members:      0,
    },
  },
  home_pro: {
    level: 1,
    quotas: {
      plants:            Infinity,
      ai_analyses:       Infinity,
      photo_storage_mb:  2048,
      properties:        1,
      team_members:      0,
    },
  },
  landscaper_pro: {
    level: 2,
    quotas: {
      plants:            Infinity,
      ai_analyses:       Infinity,
      photo_storage_mb:  10240,
      properties:        Infinity,
      team_members:      10,
    },
  },
};

const TIER_ORDER = ['free', 'home_pro', 'landscaper_pro'];

function billingEnabled() {
  return process.env.BILLING_ENABLED === 'true';
}

// Lazy-load `stripe` so test suites that don't install it still run.
function getStripe() {
  if (!billingEnabled()) return null;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  let stripeFactory;
  try {
    // eslint-disable-next-line global-require
    stripeFactory = require('stripe');
  } catch {
    return null;
  }
  return stripeFactory(key, { apiVersion: '2024-06-20' });
}

// ── Subscription resolution ──────────────────────────────────────────────────

async function readSubscription(db, userId) {
  const ref = db.collection('users').doc(userId).collection('subscription').doc('current');
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
}

/**
 * Returns the effective tier for a user. Order of precedence:
 *   1. Billing disabled → 'free' (grandfathered behaviour)
 *   2. No subscription doc → 'free'
 *   3. Stripe status is active or trialing → use the stored tier
 *   4. Otherwise → 'free' (past_due, cancelled, etc. drop to free)
 *
 * A 7-day grace window is applied to `past_due` so a transient payment
 * failure doesn't downgrade the user mid-retry.
 */
async function getCurrentTier(db, userId) {
  if (!billingEnabled()) return 'free';
  const sub = await readSubscription(db, userId);
  if (!sub) return 'free';
  // Check for active trial (isTrial flag set on subscription doc)
  if (sub.isTrial && sub.trialEnd) {
    if (new Date(sub.trialEnd).getTime() > Date.now()) {
      return sub.trialTier || 'home_pro';
    }
    // Trial expired — fall through to normal logic
  }
  if (sub.status === 'active' || sub.status === 'trialing') {
    return sub.tier && TIERS[sub.tier] ? sub.tier : 'free';
  }
  if (sub.status === 'past_due' && sub.currentPeriodEnd) {
    const end = new Date(sub.currentPeriodEnd).getTime();
    const graceMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() < end + graceMs) {
      return sub.tier && TIERS[sub.tier] ? sub.tier : 'free';
    }
  }
  return 'free';
}

function tierMeetsMinimum(current, minimum) {
  const a = TIERS[current];
  const b = TIERS[minimum];
  if (!a || !b) return false;
  return a.level >= b.level;
}

function tierQuota(tier, quotaType) {
  return TIERS[tier]?.quotas?.[quotaType] ?? 0;
}

// ── Usage counters ──────────────────────────────────────────────────────────

function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function countPlants(db, userId) {
  const snap = await db.collection('users').doc(userId).collection('plants').get();
  return snap.docs.length;
}

async function readAiAnalysesUsage(db, userId, key = monthKey()) {
  const ref = db.collection('users').doc(userId).collection('usage').doc(key);
  const snap = await ref.get();
  return (snap.exists ? snap.data()?.aiAnalyses : 0) || 0;
}

async function incrementAiAnalyses(db, userId) {
  const key = monthKey();
  const ref = db.collection('users').doc(userId).collection('usage').doc(key);
  const snap = await ref.get();
  const current = (snap.exists ? snap.data()?.aiAnalyses : 0) || 0;
  await ref.set({ aiAnalyses: current + 1, updatedAt: new Date().toISOString() }, { merge: true });
  return current + 1;
}

async function readStorageUsageMb(db, userId) {
  const ref = db.collection('users').doc(userId).collection('usage').doc('storage');
  const snap = await ref.get();
  return (snap.exists ? snap.data()?.bytes : 0) / (1024 * 1024) || 0;
}

// ── Webhook event handler ────────────────────────────────────────────────────

/**
 * Persist a Stripe subscription/checkout event into Firestore, resolving
 * userId via the stripeCustomers reverse index. Idempotency is enforced
 * upstream in the /billing/webhook route using the Stripe event.id.
 */
async function applySubscriptionEvent(db, event) {
  const obj = event?.data?.object || {};
  let userId = null;
  let stripeCustomerId = obj.customer || null;

  if (event.type === 'checkout.session.completed') {
    userId = obj.client_reference_id || null;
    stripeCustomerId = obj.customer || null;
    const tier = obj.metadata?.tier || null;
    if (userId && stripeCustomerId) {
      await db.collection('stripeCustomers').doc(stripeCustomerId).set({
        userId, updatedAt: new Date().toISOString(),
      }, { merge: true });
      await db.collection('users').doc(userId).collection('subscription').doc('current').set({
        tier,
        stripeCustomerId,
        stripeSubscriptionId: obj.subscription || null,
        status: 'active',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    return;
  }

  // For everything else, resolve userId from the reverse index.
  if (stripeCustomerId) {
    const mapSnap = await db.collection('stripeCustomers').doc(stripeCustomerId).get();
    if (mapSnap.exists) userId = mapSnap.data().userId;
  }
  if (!userId) return; // unknown customer — swallow silently, log upstream

  const ref = db.collection('users').doc(userId).collection('subscription').doc('current');
  const update = { updatedAt: new Date().toISOString() };

  if (event.type.startsWith('customer.subscription.')) {
    update.stripeSubscriptionId = obj.id || null;
    update.status = event.type === 'customer.subscription.deleted' ? 'canceled' : (obj.status || 'active');
    if (obj.current_period_end) update.currentPeriodEnd = new Date(obj.current_period_end * 1000).toISOString();
    if (typeof obj.cancel_at_period_end === 'boolean') update.cancelAtPeriodEnd = obj.cancel_at_period_end;
    if (obj.metadata?.tier) update.tier = obj.metadata.tier;
  } else if (event.type === 'invoice.payment_failed') {
    update.status = 'past_due';
  } else if (event.type === 'invoice.payment_succeeded') {
    update.status = 'active';
  }

  await ref.set(update, { merge: true });
}

module.exports = {
  TIERS,
  TIER_ORDER,
  billingEnabled,
  getStripe,
  readSubscription,
  getCurrentTier,
  tierMeetsMinimum,
  tierQuota,
  countPlants,
  readAiAnalysesUsage,
  incrementAiAnalyses,
  readStorageUsageMb,
  applySubscriptionEvent,
  monthKey,
};
