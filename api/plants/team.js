'use strict';

// Landscaper Pro team membership layer — issue #163.
//
// Data layout:
//  users/{ownerUid}/team/{memberUid}   — org-facing membership doc
//  teamMemberships/{memberUid}/orgs/{ownerUid} — reverse lookup for "my orgs"
//  teamInvites/{token}                 — short-lived invite tokens
//
// Roles: owner (implicit — the org owner's own UID), manager, technician.
// Mapped to household write-gate roles: manager → editor, technician → viewer.

const crypto = require('crypto');
const { safeUserKey } = require('./households');

// ── Constants ────────────────────────────────────────────────────────────────

const ORG_ROLES = { technician: 0, manager: 1 };
const ORG_ROLE_TO_HH_ROLE = { manager: 'editor', technician: 'viewer' };
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Firestore ref helpers ────────────────────────────────────────────────────

function teamRef(db, ownerUid) {
  return db.collection('users').doc(ownerUid).collection('team');
}

function teamMemberRef(db, ownerUid, memberUid) {
  return teamRef(db, ownerUid).doc(memberUid);
}

function orgMembershipRef(db, memberUid, ownerUid) {
  return db.collection('teamMemberships').doc(memberUid).collection('orgs').doc(ownerUid);
}

function teamInvitesRef(db) {
  return db.collection('teamInvites');
}

// ── Token generation ─────────────────────────────────────────────────────────

function generateInviteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// ── Org context resolution (called in attachHouseholdContext) ────────────────

/**
 * Resolve the org context for a request with x-org-id header.
 * Returns null when the header is absent, invalid, or the membership is not active.
 * When valid, the caller should set req.userId = ownerUid, req.orgRole, req.role.
 */
async function resolveOrgContext(db, actorSub, orgId) {
  if (!orgId || typeof orgId !== 'string') return null;
  // Reject if identical to own UID (owner makes requests without x-org-id)
  if (orgId === actorSub) return null;
  let safeOrgId;
  try { safeOrgId = safeUserKey(orgId); } catch { return null; }

  const doc = await orgMembershipRef(db, actorSub, safeOrgId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.status !== 'active') return null;

  return {
    userId: safeOrgId,      // owner's UID — data access key
    orgRole: data.role,
    role: ORG_ROLE_TO_HH_ROLE[data.role] || 'viewer',
  };
}

// ── Invite CRUD ──────────────────────────────────────────────────────────────

async function createInvite(db, { ownerUid, role, assignedPropertyIds }) {
  if (!(role in ORG_ROLES)) throw Object.assign(new Error('invalid_role'), { code: 'invalid_role' });
  const token = generateInviteToken();
  const now = new Date().toISOString();
  const data = {
    ownerUid,
    role,
    assignedPropertyIds: Array.isArray(assignedPropertyIds) ? assignedPropertyIds : null,
    status: 'pending',
    createdAt: now,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
  };
  await teamInvitesRef(db).doc(token).set(data);
  return { token, ...data };
}

async function readInvite(db, token) {
  if (typeof token !== 'string' || !token) return null;
  const doc = await teamInvitesRef(db).doc(token).get();
  return doc.exists ? { token, ...doc.data() } : null;
}

async function acceptInvite(db, { token, actorUserId }) {
  const invite = await readInvite(db, token);
  if (!invite) throw Object.assign(new Error('invite_not_found'), { code: 'not_found' });
  if (invite.status !== 'pending')
    throw Object.assign(new Error('invite_already_used'), { code: 'already_used' });
  if (new Date(invite.expiresAt).getTime() < Date.now())
    throw Object.assign(new Error('invite_expired'), { code: 'expired' });

  const safeActor = safeUserKey(actorUserId);
  const now = new Date().toISOString();
  const { ownerUid, role, assignedPropertyIds } = invite;

  const memberData = {
    role,
    assignedPropertyIds: assignedPropertyIds || null,
    status: 'active',
    invitedAt: invite.createdAt,
    joinedAt: now,
  };

  await teamMemberRef(db, ownerUid, safeActor).set(memberData, { merge: true });
  await orgMembershipRef(db, safeActor, ownerUid).set(
    { ownerUid, role, status: 'active', joinedAt: now },
    { merge: true },
  );
  await teamInvitesRef(db).doc(token).set(
    { status: 'accepted', acceptedBy: actorUserId, acceptedAt: now },
    { merge: true },
  );

  return { ownerUid, role };
}

// ── Quota counting ───────────────────────────────────────────────────────────

async function countActiveMembers(db, ownerUid) {
  const snap = await teamRef(db, ownerUid).get();
  return snap.docs.filter((d) => d.data().status === 'active').length;
}

// ── List helpers ─────────────────────────────────────────────────────────────

async function listMembers(db, ownerUid) {
  const snap = await teamRef(db, ownerUid).get();
  return snap.docs
    .filter((d) => d.data().status !== 'suspended')
    .map((d) => ({ memberUid: d.id, ...d.data() }));
}

async function listOrgsForUser(db, memberUid) {
  const snap = await db.collection('teamMemberships').doc(memberUid).collection('orgs').get();
  return snap.docs
    .filter((d) => d.data().status === 'active')
    .map((d) => ({ ownerUid: d.id, ...d.data() }));
}

module.exports = {
  ORG_ROLES,
  ORG_ROLE_TO_HH_ROLE,
  teamRef,
  teamMemberRef,
  orgMembershipRef,
  resolveOrgContext,
  createInvite,
  readInvite,
  acceptInvite,
  countActiveMembers,
  listMembers,
  listOrgsForUser,
};
