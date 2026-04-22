/**
 * Design token catalogue.
 * Renders the full typography scale, colour palettes (all 9 themes),
 * spacing scale, motion tokens, and z-index layers — all derived from
 * the source CSS custom properties and SCSS variables.
 */

export default {
  title: 'Design Tokens/Overview',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Living reference for every design token used across the app. ' +
          'See `DESIGN.md` for the full typography spec.',
      },
    },
  },
}

// ─── Typography ──────────────────────────────────────────────────────────────

const TYPE_SCALE = [
  { token: '--tx-size-xs',   size: '0.75rem',   px: 12, use: 'Metadata, timestamps, captions' },
  { token: '--tx-size-sm',   size: '0.875rem',  px: 14, use: 'Body text, form labels, panel headers' },
  { token: '--tx-size-base', size: '1rem',      px: 16, use: 'Large body, feature descriptions' },
  { token: '--tx-size-lg',   size: '1.25rem',   px: 20, use: 'Section headings, chart titles' },
  { token: '--tx-size-xl',   size: '1.5625rem', px: 25, use: 'Sub-display figures' },
  { token: '--tx-size-2xl',  size: '1.9375rem', px: 31, use: 'Display — empty-state headings' },
  { token: '--tx-size-3xl',  size: '2.4375rem', px: 39, use: 'Hero / marketing surfaces' },
]

export const TypographyScale = {
  name: 'Typography Scale',
  render: () => (
    <div style={{ fontFamily: 'inherit', maxWidth: 720 }}>
      <h4 className="tx-heading mb-3">Type Scale — Major Third (×1.25) · Base 16 px</h4>
      <div className="d-flex flex-column gap-3">
        {TYPE_SCALE.map(({ token, size, px, use }) => (
          <div key={token} className="d-flex align-items-baseline gap-4 border-bottom pb-3">
            <div style={{ width: 130, flexShrink: 0 }}>
              <code className="tx-muted" style={{ fontSize: 11 }}>{token}</code>
              <div className="tx-muted mt-1">{size} / {px}px</div>
            </div>
            <span style={{ fontSize: size, fontWeight: 400, lineHeight: 1.4 }}>
              The quick brown fox
            </span>
            <span className="tx-muted ms-auto" style={{ fontSize: 12, minWidth: 220 }}>{use}</span>
          </div>
        ))}
      </div>

      <h4 className="tx-heading mt-5 mb-3">Semantic Utility Classes</h4>
      <div className="d-flex flex-column gap-2">
        {[
          { cls: 'tx-display', sample: 'Display heading' },
          { cls: 'tx-heading',  sample: 'Section heading' },
          { cls: 'tx-title',    sample: 'Panel / modal title' },
          { cls: 'tx-body',     sample: 'Paragraph body copy' },
          { cls: 'tx-muted',   sample: 'Timestamp · metadata · caption' },
        ].map(({ cls, sample }) => (
          <div key={cls} className="d-flex align-items-center gap-3">
            <code style={{ width: 110, fontSize: 11, flexShrink: 0 }}>.{cls}</code>
            <span className={cls}>{sample}</span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ─── Colour Palettes ─────────────────────────────────────────────────────────

const THEMES = ['olive', 'earth', 'aurora', 'lunar', 'nebula', 'night', 'solar', 'storm', 'flare']

const THEME_SWATCHES = {
  olive:  { primary: '#5d623b', accent: '#8b9459', bg: '#f4f6ea' },
  earth:  { primary: '#7a5c3c', accent: '#b08060', bg: '#f6f0ea' },
  aurora: { primary: '#2d6a6a', accent: '#4a9999', bg: '#eaf4f4' },
  lunar:  { primary: '#3d3d5c', accent: '#6a6a99', bg: '#eeeef6' },
  nebula: { primary: '#5c3d6a', accent: '#8a5e99', bg: '#f2eef6' },
  night:  { primary: '#2a2a3c', accent: '#4a4a6a', bg: '#14181e' },
  solar:  { primary: '#6a4a1c', accent: '#c87d2c', bg: '#f6f0e4' },
  storm:  { primary: '#2a4a5c', accent: '#4a7a99', bg: '#e8f0f6' },
  flare:  { primary: '#6a2a2a', accent: '#b04040', bg: '#f6e8e8' },
}

export const ColourPalettes = {
  name: 'Colour Palettes',
  render: () => (
    <div style={{ maxWidth: 840 }}>
      <h4 className="tx-heading mb-3">9 Theme Palettes</h4>
      <p className="tx-muted mb-4">
        Selected via <code>LayoutContext.changeThemeStyle()</code>. The active palette
        is loaded from <code>public/css/&#123;theme&#125;.css</code>. Olive is the default.
      </p>
      <div className="row g-3">
        {THEMES.map((name) => {
          const sw = THEME_SWATCHES[name]
          return (
            <div key={name} className="col-6 col-md-4">
              <div className="border rounded overflow-hidden">
                <div style={{ background: sw.bg, padding: '12px 12px 6px' }}>
                  <div className="d-flex gap-2 mb-2">
                    <div
                      style={{ width: 32, height: 32, borderRadius: 4, background: sw.primary }}
                      title="Primary"
                    />
                    <div
                      style={{ width: 32, height: 32, borderRadius: 4, background: sw.accent }}
                      title="Accent"
                    />
                    <div
                      style={{ width: 32, height: 32, borderRadius: 4, background: sw.bg, border: '1px solid #ccc' }}
                      title="Background"
                    />
                  </div>
                </div>
                <div className="px-2 py-1 bg-body-tertiary">
                  <span className="fw-600 text-capitalize" style={{ fontSize: 13 }}>{name}</span>
                  {name === 'olive' && (
                    <span className="badge bg-success ms-2" style={{ fontSize: 10 }}>default</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  ),
}

// ─── Spacing ─────────────────────────────────────────────────────────────────

const SPACING = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48]

export const SpacingScale = {
  name: 'Spacing Scale',
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <h4 className="tx-heading mb-3">Spacing — Bootstrap 4px grid</h4>
      <p className="tx-muted mb-4">
        All spacing uses Bootstrap's 4 px grid via utility classes (<code>.gap-2</code>,{' '}
        <code>.p-3</code>, etc.) or explicit <code>px</code> values.
      </p>
      <div className="d-flex flex-column gap-2">
        {SPACING.map((u) => (
          <div key={u} className="d-flex align-items-center gap-3">
            <code style={{ width: 40, fontSize: 11, flexShrink: 0 }}>{u * 4}px</code>
            <div
              style={{
                width: u * 4,
                height: 16,
                background: 'var(--bs-primary, #5d623b)',
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span className="tx-muted" style={{ fontSize: 11 }}>
              {u}× · <code>.gap-{u > 5 ? `[custom]` : u}</code>
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
}

// ─── Motion Tokens ───────────────────────────────────────────────────────────

export const MotionTokens = {
  name: 'Motion Tokens',
  render: () => (
    <div style={{ maxWidth: 580 }}>
      <h4 className="tx-heading mb-3">Animation Timing</h4>
      <p className="tx-muted mb-4">
        Defined in <code>src/motion/tokens.js</code>. All framer-motion transitions use
        these values; do not hard-code durations elsewhere.
      </p>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Token</th>
            <th>Value (s)</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>DURATION.fast</code></td><td>0.12</td><td>Exit / dismiss animations</td></tr>
          <tr><td><code>DURATION.normal</code></td><td>0.20</td><td>Standard element enter/exit</td></tr>
          <tr><td><code>DURATION.slow</code></td><td>0.32</td><td>Page transitions, sheet slides</td></tr>
          <tr><td><code>EASE.out</code></td><td>[0,0,0.2,1]</td><td>Natural deceleration (most transitions)</td></tr>
          <tr><td><code>EASE.inOut</code></td><td>[0.4,0,0.2,1]</td><td>Bidirectional element morphs</td></tr>
          <tr><td><code>STAGGER_DELAY</code></td><td>0.04</td><td>Per-item offset in list stagger</td></tr>
        </tbody>
      </table>
    </div>
  ),
}

// ─── Z-Index Layers ───────────────────────────────────────────────────────────

const Z_LAYERS = [
  { name: 'leaflet-map',    value: 400,  note: 'Leaflet layer pane' },
  { name: 'leaflet-marker', value: 600,  note: 'Leaflet marker pane' },
  { name: 'sticky / fixed', value: 1020, note: 'Bootstrap sticky top/fixed' },
  { name: 'offcanvas',      value: 1045, note: 'Bootstrap offcanvas backdrop' },
  { name: 'modal-backdrop', value: 1050, note: 'Bootstrap modal backdrop' },
  { name: 'modal',          value: 1055, note: 'Bootstrap modal' },
  { name: 'popover',        value: 1070, note: 'Bootstrap popovers' },
  { name: 'tooltip',        value: 1080, note: 'Bootstrap tooltips' },
  { name: 'toast',          value: 9999, note: 'App toast notifications (top-end)' },
]

export const ZIndexLayers = {
  name: 'Z-Index Layers',
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <h4 className="tx-heading mb-3">Z-Index Stack</h4>
      <table className="table table-sm">
        <thead>
          <tr><th>Layer</th><th>z-index</th><th>Note</th></tr>
        </thead>
        <tbody>
          {Z_LAYERS.map(({ name, value, note }) => (
            <tr key={name}>
              <td><code>{name}</code></td>
              <td>{value}</td>
              <td className="tx-muted" style={{ fontSize: 12 }}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}
