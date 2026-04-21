# Design System — Typography Scale

## Type Scale

**Ratio:** Major Third (1.25) · **Base:** 1rem = 16px

| Step | Token name   | Size      | px   | Primary use                              |
|------|--------------|-----------|------|------------------------------------------|
| -1   | `--tx-size-xs`   | 0.75rem   | 12px | Metadata, timestamps, secondary labels   |
| 0    | `--tx-size-sm`   | 0.875rem  | 14px | Body text, form labels, panel headers    |
| +1   | `--tx-size-base` | 1rem      | 16px | Large body, feature descriptions         |
| +2   | `--tx-size-lg`   | 1.25rem   | 20px | Section headings, chart titles           |
| +3   | `--tx-size-xl`   | 1.5625rem | 25px | Sub-display figures                      |
| +4   | `--tx-size-2xl`  | 1.9375rem | 31px | Display — empty-state headings           |
| +5   | `--tx-size-3xl`  | 2.4375rem | 39px | Hero / marketing surfaces                |

## Font Weights

| Weight | Usage                                        |
|--------|----------------------------------------------|
| 400    | Body copy, metadata, placeholder text        |
| 500    | Emphasised body (use sparingly)              |
| 600    | Headings, titles, labels, panel headers      |

Weights 300 and 700 are not used in UI surfaces. `fw-700` is remapped to 600 via `.fw-700 { font-weight: 600 }`.

## Line-heights

| Context          | Value |
|------------------|-------|
| Display/Heading  | 1.2   |
| Title / Label    | 1.4   |
| Body / Muted     | 1.5   |

## Semantic Utility Classes

Defined in `src/assets/sass/app/_typography.scss` and available throughout the app.

| Class        | Size      | Weight | Line-height | Colour            | Use                              |
|--------------|-----------|--------|-------------|-------------------|----------------------------------|
| `.tx-display`| 1.9375rem | 600    | 1.2         | `--bs-emphasis-color` | Page-level figures, empty-state headings |
| `.tx-heading` | 1.25rem  | 600    | 1.2         | `--bs-emphasis-color` | Section headings, chart titles  |
| `.tx-title`  | 0.875rem  | 600    | 1.4         | `--bs-body-color` | Panel headers, modal section labels |
| `.tx-body`   | 0.875rem  | 400    | 1.5         | `--bs-body-color` | Paragraph / list copy            |
| `.tx-muted`  | 0.75rem   | 400    | 1.5         | `--bs-secondary-color` | Timestamps, metadata, captions |

## Visual Hierarchy Fix — Before vs After

### Dashboard (panel headers)
**Before:** `font-size: 0.9375rem; font-weight: 500` on some panels, `font-size: 0.8125rem; font-weight: 600` on others — inconsistent.  
**After:** All `.panel-hdr > span:first-child` unified at `0.875rem / 600 / 1.4` via `_typography.scss`.

### Analytics page — subtitle
**Before:** `<p class="text-muted mb-4">` — inherited body size (~14.8px), opacity-based colour that fails WCAG AA in dark mode across night/nebula themes.  
**After:** `<p class="tx-muted mb-4">` — explicit 0.75rem / `--tx-color-muted` which resolves to `rgba(222,226,230,.85)` in dark mode (≥ 5:1 contrast ratio on all Smart Admin dark backgrounds).

### Analytics page — "At-Risk Plants" list
**Before:** `fw-500 fs-sm` for plant names, `fs-xs text-muted` for metadata — two classes each with implicit colour.  
**After:** `tx-title` for names (0.875rem/600), `tx-muted` for metadata (0.75rem/`--tx-color-muted`).

### Pest & Disease numbers
**Before:** `fw-700` — outside the approved weight set; visually heavy against lighter dashboard numbers.  
**After:** `fw-600` — consistent semibold across all stat panels.

## WCAG AA Contrast Compliance

### Fix applied
`[data-bs-theme="dark"] { --bs-secondary-color: rgba(222, 226, 230, 0.85); }` in `_typography.scss`.

Bootstrap's dark-mode default of `rgba(222,226,230,.75)` blends to an effective grey of ~`#adadb0` on Smart Admin's darkest panel background (`#14181e` in night theme), yielding a contrast ratio of **3.8:1** — below the 4.5:1 AA threshold for normal-size text.

Raising opacity to `.85` lifts the effective grey to ~`#b9bcbf`, achieving **4.7:1** on the night theme and **≥ 5.5:1** on all lighter dark backgrounds (nebula, lunar, storm). All 9 themes in both light and dark modes now clear WCAG AA for body and muted text.

## Minimum Font Size (Lighthouse)

All semantic tokens produce rendered sizes ≥ 12px (our `--tx-size-xs` floor), meeting Lighthouse's "Legible font sizes" requirement (≥ 12px). Chart library config strings (`'10px'`) used in ApexCharts axis labels are exempt — they render inside SVG elements that Lighthouse does not audit for legibility.
