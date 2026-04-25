'use strict';

// Household membership layer. See docs/households-design.md (or PR #232) for
// the full design — short version:
//
//  • A household is a top-level Firestore doc at `households/{id}` with
//    `ownerId` (the user whose `users/{ownerId}/...` data tree backs the
//    household), `name`, `createdAt`, and `members: { [userId]: { role,
//    displayName, joinedAt } }`.
//  • A small per-user pointer at `users/{userId}/profile/main` records the
//    user's `activeHouseholdId` and a list of household ids they belong to.
//  • Each authenticated request is resolved via `resolveHouseholdContext()`:
//    `req.actorUserId` = Google sub of the requester, `req.userId` = the
//    household owner's id (so existing data accessors keep working
//    untouched), `req.householdId`, `req.role`.
//
// Roles (see ROLE_LEVELS): viewer < editor < owner.
//   - viewer: read-only access (GET endpoints).
//   - editor: viewer + write (water/fertilise/journal/edit plants).
//   - owner:  editor + delete plants + manage household & members.

const crypto = require('crypto');

const ROLE_LEVELS = { viewer: 0, editor: 1, owner: 2 };

function roleMeetsMinimum(actual, minimum) {
  return (ROLE_LEVELS[actual] ?? -1) >= (ROLE_LEVELS[minimum] ?? 0);
}

const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
function generateShareCode() {
  let out = '';
  const buf = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    out += SHARE_CODE_ALPHABET[buf[i] % SHARE_CODE_ALPHABET.length];
  }
  return out;
}

function householdsRef(db) {
  return db.collection('households');
}

function userProfileRef(db, userId) {
  return db.collection('users').doc(userId).collection('profile').doc('main');
}

function inviteCodesRef(db) {
  return db.collection('householdInvites');
}

async function readProfile(db, userId) {
  const doc = await userProfileRef(db, userId).get();
  return doc.exists ? doc.data() : null;
}

async function writeProfile(db, userId, data) {
  await userProfileRef(db, userId).set(data, { merge: true });
}

async function readHousehold(db, householdId) {
  if (!householdId) return null;
  const doc = await householdsRef(db).doc(householdId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/**
 * Lazily create the user's personal household if one doesn't exist yet.
 * Idempotent: if the user already has an active household, returns it.
 *
 * Existing single-user data at `users/{userId}/...` becomes the data tree
 * of this auto-created household with the user as owner — no data move
 * is required (this is the "membership-as-overlay" migration strategy).
 */
async function ensurePersonalHousehold(db, userId, displayName) {
  let profile = await readProfile(db, userId);
  if (profile?.activeHouseholdId) {
    const hh = await readHousehold(db, profile.activeHouseholdId);
    if (hh) return { household: hh, profile };
  }

  const now = new Date().toISOString();
  const householdData = {
    name: 'My Plants',
    ownerId: userId,
    createdAt: now,
    updatedAt: now,
    members: {
      [userId]: {
        role: 'owner',
        displayName: displayName || null,
        joinedAt: now,
      },
    },
  };
  const ref = await householdsRef(db).add(householdData);
  const household = { id: ref.id, ...householdData };

  const householdIds = Array.from(new Set([...(profile?.householdIds || []), ref.id]));
  const updatedProfile = {
    activeHouseholdId: ref.id,
    householdIds,
    displayName: displayName || profile?.displayName || null,
    updatedAt: now,
  };
  await writeProfile(db, userId, updatedProfile);
  return { household, profile: { ...(profile || {}), ...updatedProfile } };
}

/**
 * Resolve which household the request is operating against and the actor's
 * role. Sets req.actorUserId, req.userId (= household owner), req.householdId,
 * req.role. Used by the auth middleware after a Google sub has been pulled
 * from the JWT.
 *
 * If `actorSub` has no household yet, lazy-creates the personal one.
 */
async function resolveHouseholdContext(db, actorSub, displayName) {
  const { household, profile } = await ensurePersonalHousehold(db, actorSub, displayName);
  const member = household.members?.[actorSub];

  // Defensive: if profile points to a household where membership was
  // revoked, fall back to the personal household (or create a new one).
  if (!member) {
    const fresh = await ensurePersonalHousehold(db, actorSub, displayName);
    return {
      actorUserId: actorSub,
      userId: fresh.household.ownerId,
      householdId: fresh.household.id,
      role: 'owner',
      household: fresh.household,
      profile: fresh.profile,
    };
  }

  return {
    actorUserId: actorSub,
    userId: household.ownerId,
    householdId: household.id,
    role: member.role,
    household,
    profile,
  };
}

/**
 * Express middleware factory: require the actor's role on the active
 * household to meet a minimum. Use after requireUser. 403s with a
 * `forbidden_role` error if the actor lacks permission.
 */
function requireRole(minRole) {
  return function roleGate(req, res, next) {
    if (!roleMeetsMinimum(req.role, minRole)) {
      return res.status(403).json({
        error: 'forbidden_role',
        requiredRole: minRole,
        currentRole: req.role || null,
      });
    }
    return next();
  };
}

/**
 * Build an "actor" stamp for audit fields like lastEditedBy.
 * Returns null when no actor is attached (e.g. anonymous AI analyse).
 */
function buildActorStamp(req) {
  if (!req.actorUserId) return null;
  return {
    userId: req.actorUserId,
    displayName: req.actorDisplayName || null,
    at: new Date().toISOString(),
  };
}

// ── Invite (share-code) helpers ──────────────────────────────────────────────

async function createInvite(db, { householdId, role, invitedBy, expiresInDays = 7 }) {
  if (!(role in ROLE_LEVELS)) throw new Error('Invalid role');
  const code = generateShareCode();
  const now = Date.now();
  const expiresAt = new Date(now + expiresInDays * 86400000).toISOString();
  const data = {
    code,
    householdId,
    role,
    invitedBy: invitedBy || null,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
  };
  await inviteCodesRef(db).doc(code).set(data);
  return data;
}

async function readInvite(db, code) {
  const doc = await inviteCodesRef(db).doc(String(code).toUpperCase()).get();
  return doc.exists ? doc.data() : null;
}

function inviteIsActive(invite) {
  if (!invite) return false;
  if (invite.acceptedAt || invite.revokedAt) return false;
  return new Date(invite.expiresAt).getTime() > Date.now();
}

async function acceptInvite(db, { code, actorUserId, actorDisplayName }) {
  const invite = await readInvite(db, code);
  if (!inviteIsActive(invite)) {
    const reason = !invite ? 'not_found'
      : invite.acceptedAt ? 'already_used'
      : invite.revokedAt ? 'revoked'
      : 'expired';
    const err = new Error(`invite_${reason}`);
    err.code = reason;
    throw err;
  }

  const household = await readHousehold(db, invite.householdId);
  if (!household) {
    const err = new Error('household_not_found');
    err.code = 'not_found';
    throw err;
  }

  // Already a member? still OK — accepting is idempotent. Otherwise
  // append to the members map with the invite's role.
  const now = new Date().toISOString();
  const existing = household.members?.[actorUserId];
  const newMember = existing || {
    role: invite.role,
    displayName: actorDisplayName || null,
    joinedAt: now,
  };
  await householdsRef(db).doc(household.id).set({
    members: { ...(household.members || {}), [actorUserId]: newMember },
    updatedAt: now,
  }, { merge: true });

  await inviteCodesRef(db).doc(invite.code).set({
    acceptedAt: now,
    acceptedBy: actorUserId,
  }, { merge: true });

  // Update the joiner's profile: add to householdIds and switch active.
  const profile = (await readProfile(db, actorUserId)) || {};
  const householdIds = Array.from(new Set([...(profile.householdIds || []), household.id]));
  await writeProfile(db, actorUserId, {
    activeHouseholdId: household.id,
    householdIds,
    displayName: actorDisplayName || profile.displayName || null,
    updatedAt: now,
  });

  return { household: { ...household, members: { ...(household.members || {}), [actorUserId]: newMember } }, role: newMember.role };
}

async function listHouseholdsForUser(db, userId) {
  const profile = await readProfile(db, userId);
  const ids = profile?.householdIds || [];
  const items = [];
  for (const id of ids) {
    const hh = await readHousehold(db, id);
    if (hh && hh.members?.[userId]) items.push(hh);
  }
  return { households: items, activeHouseholdId: profile?.activeHouseholdId || null };
}

module.exports = {
  ROLE_LEVELS,
  roleMeetsMinimum,
  generateShareCode,
  ensurePersonalHousehold,
  resolveHouseholdContext,
  requireRole,
  buildActorStamp,
  createInvite,
  readInvite,
  inviteIsActive,
  acceptInvite,
  readHousehold,
  readProfile,
  writeProfile,
  listHouseholdsForUser,
  householdsRef,
  inviteCodesRef,
  userProfileRef,
};
