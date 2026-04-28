'use strict';

// Recurring maintenance templates — issue #297.
//
// Firestore paths:
//   users/{ownerUid}/templates/{templateId}   — user-owned templates
//   platform/templates/{templateId}            — curated library (empty for v1)

const TASK_TYPES = new Set(['watering', 'pruning', 'fertilising', 'inspection', 'custom']);

// ── Firestore ref helpers ────────────────────────────────────────────────────

function templatesRef(db, ownerUid) {
  return db.collection('users').doc(ownerUid).collection('templates');
}

function templateRef(db, ownerUid, templateId) {
  return templatesRef(db, ownerUid).doc(templateId);
}

function platformTemplatesRef(db) {
  return db.collection('platform').doc('templates').collection('items');
}

// ── Template validation ──────────────────────────────────────────────────────

function validateItems(items) {
  if (!Array.isArray(items)) return 'items must be an array';
  for (const item of items) {
    if (!item.title || typeof item.title !== 'string') return 'each item must have a title';
    if (item.taskType && !TASK_TYPES.has(item.taskType)) {
      return `invalid taskType "${item.taskType}". Must be one of: ${[...TASK_TYPES].join(', ')}`;
    }
  }
  return null;
}

// ── Checklist preview ────────────────────────────────────────────────────────

/**
 * Given a template and a plant list, return the resolved checklist items with
 * matched plant names, plus total estimated duration.
 */
function previewTemplate(template, plants) {
  const plantMap = Object.fromEntries(plants.map((p) => [p.id, p]));
  const items = (template.items || []).map((item) => {
    const matchedPlants = (item.plantIds || [])
      .map((id) => plantMap[id])
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name }));
    return { ...item, matchedPlants };
  });
  const totalMinutes = items.reduce((s, i) => s + (i.estimatedMinutes || 0), 0);
  return { items, totalMinutes };
}

module.exports = {
  TASK_TYPES,
  templatesRef,
  templateRef,
  platformTemplatesRef,
  validateItems,
  previewTemplate,
};
