'use strict';

// Landscaper visit scheduling — issue #164.
//
// Firestore paths:
//   users/{ownerUid}/visits/{visitId}         — visit documents
//   icsTokens/{token}                          — read-only iCal token lookup
//
// Recurrence: parent visits carry a `recurrence` field. When a visit is
// created with recurrence, we immediately materialise instances for the
// next 90 days (max 52 per parent), storing them with `recurrenceParentId`.
// No Cloud Scheduler needed for v1.

const crypto = require('crypto');

// ── Firestore ref helpers ────────────────────────────────────────────────────

function visitsRef(db, ownerUid) {
  return db.collection('users').doc(ownerUid).collection('visits');
}

function visitRef(db, ownerUid, visitId) {
  return visitsRef(db, ownerUid).doc(visitId);
}

function icsTokensRef(db) {
  return db.collection('icsTokens');
}

// ── iCal token ───────────────────────────────────────────────────────────────

async function getOrCreateIcsToken(db, userId) {
  const configRef = db.collection('users').doc(userId).collection('config').doc('icsToken');
  const snap = await configRef.get();
  if (snap.exists && snap.data().token) return snap.data().token;

  const token = crypto.randomBytes(32).toString('base64url');
  await configRef.set({ token, createdAt: new Date().toISOString() });
  await icsTokensRef(db).doc(token).set({ userId, createdAt: new Date().toISOString() });
  return token;
}

async function resolveIcsToken(db, token) {
  if (!token || typeof token !== 'string') return null;
  const doc = await icsTokensRef(db).doc(token).get();
  return doc.exists ? doc.data().userId : null;
}

// ── Recurrence helpers ───────────────────────────────────────────────────────

const FREQ_STEP_MS = {
  daily:       1 * 24 * 60 * 60 * 1000,
  weekly:      7 * 24 * 60 * 60 * 1000,
  fortnightly: 14 * 24 * 60 * 60 * 1000,
  monthly:     null, // handled specially
};

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Materialise recurring instances from a parent visit.
 * Returns an array of visit data objects (without ids) for the next 90 days.
 */
function buildInstances(parent, nowMs) {
  const rec = parent.recurrence;
  if (!rec || !rec.freq) return [];

  const horizon = nowMs + 90 * 24 * 60 * 60 * 1000;
  const maxInstances = 52;
  const instances = [];

  let cursor = new Date(parent.scheduledStart).getTime();
  const interval = rec.interval || 1;
  const until = rec.until ? new Date(rec.until).getTime() : horizon;
  const count = rec.count || maxInstances;

  while (instances.length < count && cursor <= Math.min(horizon, until)) {
    if (cursor > nowMs) {
      const start = new Date(cursor);
      const base = { ...parent };
      delete base.recurrence;
      base.scheduledStart = start.toISOString();
      if (parent.scheduledEnd) {
        const duration = new Date(parent.scheduledEnd) - new Date(parent.scheduledStart);
        base.scheduledEnd = new Date(cursor + duration).toISOString();
      }
      base.status = 'scheduled';
      base.recurrenceParentId = parent.id;
      delete base.id;
      instances.push(base);
    }

    if (rec.freq === 'monthly') {
      cursor = addMonths(cursor, interval).getTime();
    } else {
      const step = FREQ_STEP_MS[rec.freq];
      if (!step) break;
      cursor += step * interval;
    }
  }

  return instances;
}

/**
 * Materialise instances for all recurrence parents not yet covered in the
 * next 90 days. Idempotent: skips parents that already have a child visit
 * scheduled in the horizon window.
 */
async function materialiseUpcoming(db, ownerUid) {
  const snap = await visitsRef(db, ownerUid).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const parents = all.filter((v) => v.recurrence && !v.recurrenceParentId);
  const childParentIds = new Set(all.map((v) => v.recurrenceParentId).filter(Boolean));

  const nowMs = Date.now();
  const batch = [];
  for (const parent of parents) {
    if (childParentIds.has(parent.id)) continue; // already has children
    const instances = buildInstances(parent, nowMs);
    for (const inst of instances) {
      batch.push(inst);
    }
  }

  for (const inst of batch) {
    await visitsRef(db, ownerUid).add(inst);
  }

  return batch.length;
}

// ── RBAC filter ──────────────────────────────────────────────────────────────

/**
 * Apply RBAC filtering to a list of visits based on the actor's org role.
 * - owner (no orgRole): sees all visits
 * - manager: sees visits for their assignedPropertyIds
 * - technician: sees only visits assignedTo them
 */
function applyVisitRbac(visits, orgRole, actorUserId, assignedPropertyIds) {
  if (!orgRole) return visits;
  if (orgRole === 'technician') {
    return visits.filter((v) => v.assignedTo === actorUserId);
  }
  if (orgRole === 'manager' && Array.isArray(assignedPropertyIds) && assignedPropertyIds.length > 0) {
    const allowed = new Set(assignedPropertyIds);
    return visits.filter((v) => allowed.has(v.propertyId));
  }
  return visits; // manager with no property restrictions sees all
}

// ── iCal generation ──────────────────────────────────────────────────────────

function toIcalDate(iso) {
  // Returns YYYYMMDDTHHMMSSZ format
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '');
}

function escapeIcal(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function generateIcal(visits) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plant Tracker//Plant Visits//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const v of visits) {
    if (!v.scheduledStart) continue;
    const dtStart = toIcalDate(v.scheduledStart);
    const dtEnd = v.scheduledEnd
      ? toIcalDate(v.scheduledEnd)
      : toIcalDate(new Date(new Date(v.scheduledStart).getTime() + (v.estimatedDurationMinutes || 60) * 60000).toISOString());

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:visit-${v.id}@plants.lopezcloud.dev`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcal(v.title || 'Property Visit')}`);
    if (v.notes) lines.push(`DESCRIPTION:${escapeIcal(v.notes)}`);
    const statusMap = { scheduled: 'TENTATIVE', in_progress: 'CONFIRMED', completed: 'CONFIRMED', cancelled: 'CANCELLED', no_show: 'CANCELLED' };
    lines.push(`STATUS:${statusMap[v.status] || 'TENTATIVE'}`);
    lines.push(`LAST-MODIFIED:${toIcalDate(v.updatedAt || v.createdAt || new Date().toISOString())}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

module.exports = {
  visitsRef,
  visitRef,
  icsTokensRef,
  getOrCreateIcsToken,
  resolveIcsToken,
  buildInstances,
  materialiseUpcoming,
  applyVisitRbac,
  generateIcal,
};
