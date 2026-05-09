'use strict';

// Plant care report PDF template using @react-pdf/renderer.
// Deliberately uses React.createElement (not JSX) so the backend stays plain
// CommonJS with no Babel/transpile step.

const React = require('react');
const {
  Document, Page, Text, View, Image, StyleSheet, renderToBuffer,
} = require('@react-pdf/renderer');

const el = React.createElement;

const COLOR = {
  brand:       '#2d6a4f',
  brandLight:  '#e8f5e9',
  text:        '#1a1a1a',
  muted:       '#666666',
  border:      '#e0e0e0',
  excellent:   '#2d6a4f',
  good:        '#52b788',
  fair:        '#f4a261',
  poor:        '#e63946',
};

const HEALTH_COLOR = {
  Excellent: COLOR.excellent,
  Good:      COLOR.good,
  Fair:      COLOR.fair,
  Poor:      COLOR.poor,
};

const styles = StyleSheet.create({
  page:          { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: COLOR.text },
  headerRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: `2pt solid ${COLOR.brand}` },
  logo:          { width: 60, height: 60, objectFit: 'contain' },
  headerText:    { flex: 1, paddingLeft: 10 },
  title:         { fontSize: 18, fontFamily: 'Helvetica-Bold', color: COLOR.brand },
  subtitle:      { fontSize: 10, color: COLOR.muted, marginTop: 3 },
  metaRow:       { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem:      { flex: 1, padding: 10, backgroundColor: COLOR.brandLight, borderRadius: 4 },
  metaLabel:     { fontSize: 8, color: COLOR.muted, marginBottom: 2 },
  metaValue:     { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLOR.brand },
  sectionTitle:  { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 8, marginTop: 14, paddingBottom: 4, borderBottom: `1pt solid ${COLOR.border}` },
  plantCard:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, padding: 8, border: `1pt solid ${COLOR.border}`, borderRadius: 4 },
  plantThumb:    { width: 40, height: 40, borderRadius: 3, objectFit: 'cover', marginRight: 10 },
  plantInfo:     { flex: 1 },
  plantName:     { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  plantMeta:     { fontSize: 9, color: COLOR.muted },
  healthBadge:   { fontSize: 8, fontFamily: 'Helvetica-Bold', padding: '2 6', borderRadius: 3, color: '#fff', alignSelf: 'flex-start' },
  logRow:        { flexDirection: 'row', borderBottom: `0.5pt solid ${COLOR.border}`, paddingVertical: 4 },
  logDate:       { width: 80, fontSize: 9, color: COLOR.muted },
  logPlant:      { flex: 1, fontSize: 9 },
  logNote:       { flex: 2, fontSize: 9, color: COLOR.muted },
  footer:        { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: COLOR.muted, fontSize: 8 },
  pageNum:       { position: 'absolute', bottom: 30, right: 40, color: COLOR.muted, fontSize: 8 },
});

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysAgo(isoString) {
  if (!isoString) return null;
  const d = Math.floor((Date.now() - new Date(isoString).getTime()) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return '1 day ago';
  return `${d} days ago`;
}

function HealthBadge({ health }) {
  const bg = HEALTH_COLOR[health] || COLOR.muted;
  return el(Text, { style: { ...styles.healthBadge, backgroundColor: bg } }, health || 'Unknown');
}

function PlantCard({ plant, withPhoto }) {
  return el(View, { style: styles.plantCard },
    withPhoto && plant.imageUrl
      ? el(Image, { style: styles.plantThumb, src: plant.imageUrl })
      : null,
    el(View, { style: styles.plantInfo },
      el(Text, { style: styles.plantName }, plant.name || plant.species || 'Unnamed plant'),
      el(Text, { style: styles.plantMeta },
        [plant.room, plant.species].filter(Boolean).join(' · ') || 'No location',
      ),
      plant.lastWatered
        ? el(Text, { style: { ...styles.plantMeta, marginTop: 2 } }, `Last watered: ${formatDate(plant.lastWatered)} (${daysAgo(plant.lastWatered)})`)
        : null,
    ),
    el(HealthBadge, { health: plant.health }),
  );
}

function WaterLogSection({ plants, dateRange }) {
  const from = new Date(dateRange.from);
  const to   = new Date(dateRange.to);

  const rows = [];
  for (const plant of plants) {
    for (const entry of (plant.wateringLog || [])) {
      const d = new Date(entry.date);
      if (d >= from && d <= to) {
        rows.push({ plant, entry, date: d });
      }
    }
  }
  rows.sort((a, b) => b.date - a.date);

  if (rows.length === 0) return el(Text, { style: { color: COLOR.muted, fontSize: 9 } }, 'No watering events in this period.');

  return el(View, null,
    el(View, { style: { ...styles.logRow, borderBottom: `1pt solid ${COLOR.border}` } },
      el(Text, { style: { ...styles.logDate, fontFamily: 'Helvetica-Bold' } }, 'Date'),
      el(Text, { style: { ...styles.logPlant, fontFamily: 'Helvetica-Bold' } }, 'Plant'),
      el(Text, { style: { ...styles.logNote, fontFamily: 'Helvetica-Bold' } }, 'Method / Notes'),
    ),
    ...rows.map((r, i) =>
      el(View, { key: i, style: styles.logRow },
        el(Text, { style: styles.logDate }, formatDate(r.entry.date)),
        el(Text, { style: styles.logPlant }, r.plant.name || 'Unnamed'),
        el(Text, { style: styles.logNote }, r.entry.method || 'manual'),
      ),
    ),
  );
}

function FeedingLogSection({ plants, dateRange }) {
  const from = new Date(dateRange.from);
  const to   = new Date(dateRange.to);

  const rows = [];
  for (const plant of plants) {
    for (const entry of (plant.feedingLog || [])) {
      const d = new Date(entry.date);
      if (d >= from && d <= to) {
        rows.push({ plant, entry, date: d });
      }
    }
  }
  rows.sort((a, b) => b.date - a.date);

  if (rows.length === 0) return el(Text, { style: { color: COLOR.muted, fontSize: 9 } }, 'No feeding events in this period.');

  return el(View, null,
    el(View, { style: { ...styles.logRow, borderBottom: `1pt solid ${COLOR.border}` } },
      el(Text, { style: { ...styles.logDate, fontFamily: 'Helvetica-Bold' } }, 'Date'),
      el(Text, { style: { ...styles.logPlant, fontFamily: 'Helvetica-Bold' } }, 'Plant'),
      el(Text, { style: { ...styles.logNote, fontFamily: 'Helvetica-Bold' } }, 'Type'),
    ),
    ...rows.map((r, i) =>
      el(View, { key: i, style: styles.logRow },
        el(Text, { style: styles.logDate }, formatDate(r.entry.date)),
        el(Text, { style: styles.logPlant }, r.plant.name || 'Unnamed'),
        el(Text, { style: styles.logNote }, r.entry.type || 'general'),
      ),
    ),
  );
}

/**
 * Generate a PDF buffer for a plant care report.
 *
 * @param {object} opts
 * @param {object[]} opts.plants  - array of plant objects (with wateringLog, feedingLog, etc.)
 * @param {object}   opts.branding - { businessName, primaryColor, logoUrl } or null
 * @param {object}   opts.dateRange - { from: ISO, to: ISO }
 * @param {string}   opts.propertyName - display name for the property
 * @param {object}   opts.includeSections - { health, watering, feeding, photos }
 * @returns {Promise<Buffer>}
 */
async function generatePdfBuffer({ plants, branding, dateRange, propertyName, includeSections = {} }) {
  const {
    health  = true,
    watering = true,
    feeding  = true,
    photos   = true,
  } = includeSections;

  const primaryColor = branding?.primaryColor || COLOR.brand;
  const businessName = branding?.businessName || 'Plant Tracker';
  const reportTitle  = `Plant Care Report — ${propertyName || 'My Garden'}`;

  // Health summary counts
  const healthCounts = { Excellent: 0, Good: 0, Fair: 0, Poor: 0, Unknown: 0 };
  for (const p of plants) {
    const k = p.health && healthCounts[p.health] !== undefined ? p.health : 'Unknown';
    healthCounts[k]++;
  }
  const dueForWater = plants.filter((p) => {
    if (!p.frequencyDays || !p.lastWatered) return false;
    const next = new Date(new Date(p.lastWatered).getTime() + p.frequencyDays * 86400000);
    return next <= new Date();
  }).length;

  const doc = el(Document, { title: reportTitle, author: businessName },
    el(Page, { size: 'A4', style: { ...styles.page, '--primary': primaryColor } },
      // ── Header ──────────────────────────────────────────────────────────────
      el(View, { style: styles.headerRow },
        branding?.logoUrl
          ? el(Image, { style: styles.logo, src: branding.logoUrl })
          : null,
        el(View, { style: styles.headerText },
          el(Text, { style: { ...styles.title, color: primaryColor } }, reportTitle),
          el(Text, { style: styles.subtitle }, `${businessName} · Generated ${formatDate(new Date().toISOString())}`),
          el(Text, { style: styles.subtitle }, `Period: ${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`),
        ),
      ),

      // ── Summary metrics ──────────────────────────────────────────────────────
      el(View, { style: styles.metaRow },
        el(View, { style: styles.metaItem },
          el(Text, { style: styles.metaLabel }, 'TOTAL PLANTS'),
          el(Text, { style: { ...styles.metaValue, color: primaryColor } }, String(plants.length)),
        ),
        el(View, { style: styles.metaItem },
          el(Text, { style: styles.metaLabel }, 'HEALTHY (GOOD+)'),
          el(Text, { style: { ...styles.metaValue, color: primaryColor } }, String(healthCounts.Excellent + healthCounts.Good)),
        ),
        el(View, { style: styles.metaItem },
          el(Text, { style: styles.metaLabel }, 'NEED ATTENTION'),
          el(Text, { style: { ...styles.metaValue, color: healthCounts.Poor > 0 ? COLOR.poor : primaryColor } }, String(healthCounts.Fair + healthCounts.Poor)),
        ),
        el(View, { style: styles.metaItem },
          el(Text, { style: styles.metaLabel }, 'DUE FOR WATER'),
          el(Text, { style: { ...styles.metaValue, color: dueForWater > 0 ? COLOR.fair : primaryColor } }, String(dueForWater)),
        ),
      ),

      // ── Plant health section ─────────────────────────────────────────────────
      health ? el(View, null,
        el(Text, { style: styles.sectionTitle }, 'Plant Health Overview'),
        ...plants.map((p, i) => el(PlantCard, { key: i, plant: p, withPhoto: photos })),
      ) : null,

      // ── Watering log ─────────────────────────────────────────────────────────
      watering ? el(View, null,
        el(Text, { style: styles.sectionTitle }, 'Watering Log'),
        el(WaterLogSection, { plants, dateRange }),
      ) : null,

      // ── Feeding log ──────────────────────────────────────────────────────────
      feeding ? el(View, null,
        el(Text, { style: styles.sectionTitle }, 'Fertiliser Log'),
        el(FeedingLogSection, { plants, dateRange }),
      ) : null,

      // ── Footer ───────────────────────────────────────────────────────────────
      el(Text, { style: styles.footer },
        branding?.businessEmail ? `${branding.businessEmail}` : 'Generated by Plant Tracker',
      ),
      el(Text, { style: styles.pageNum, render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}` }),
    ),
  );

  return renderToBuffer(doc);
}

module.exports = { generatePdfBuffer };
