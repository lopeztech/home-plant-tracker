'use strict';

const billing = require('./billing');

/**
 * Factory returning `requireTier(minTier)` and `checkQuota(quotaType, counter)`
 * Express middleware bound to the given Firestore `db`.
 *
 * When `BILLING_ENABLED !== 'true'` both middlewares no-op so the app runs
 * unchanged until billing is switched on. This lets the code ship dark.
 */
function createTierGate(db) {
  function requireTier(minTier) {
    return async function tierGate(req, res, next) {
      if (!billing.billingEnabled()) {
        req.userTier = 'free';
        return next();
      }
      try {
        const tier = await billing.getCurrentTier(db, req.userId);
        req.userTier = tier;
        if (!billing.tierMeetsMinimum(tier, minTier)) {
          return res.status(403).json({
            error:        'upgrade_required',
            requiredTier: minTier,
            currentTier:  tier,
            upgradeUrl:   '/pricing',
          });
        }
        return next();
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    };
  }

  /**
   * `counter(req)` is an async function that returns the current usage value.
   * Kept as a parameter so the caller can pass the right query (plant count,
   * monthly AI analyses, storage bytes, etc.).
   */
  function checkQuota(quotaType, counter) {
    return async function quotaGate(req, res, next) {
      if (!billing.billingEnabled()) return next();
      // When billing is on but the request is anonymous (soft-auth routes
      // like /analyse can be called without a JWT) we let it through — the
      // quota can only be attributed to a known user.
      if (!req.userId) return next();
      try {
        const tier  = req.userTier || await billing.getCurrentTier(db, req.userId);
        const limit = billing.tierQuota(tier, quotaType);
        if (limit === Infinity) return next();
        const current = await counter(req);
        if (current >= limit) {
          return res.status(429).json({
            error:      'quota_exceeded',
            quotaType,
            limit,
            current,
            upgradeUrl: '/pricing',
          });
        }
        req.currentQuota = { quotaType, limit, current };
        return next();
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    };
  }

  return { requireTier, checkQuota };
}

module.exports = { createTierGate };
