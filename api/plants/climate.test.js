import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { classifyKoppen, deriveFrostDates } = require('./climate');

// ── classifyKoppen ────────────────────────────────────────────────────────────
// Golden test cases: locked-in expected values for well-known cities.

describe('classifyKoppen', () => {
  // London, UK — temperate oceanic: cool summers, mild winters, even rainfall
  it('returns Cfb for London', () => {
    const means = [4.5, 4.6, 6.9, 9.4, 13.0, 16.0, 18.4, 18.5, 15.3, 11.3, 7.4, 4.9];
    const precip = [57, 39, 47, 43, 49, 45, 40, 48, 49, 61, 60, 57];
    expect(classifyKoppen(means, precip)).toBe('Cfb');
  });

  // Denver, CO, USA — cold semi-arid steppe: low annual precipitation
  it('returns BSk for Denver', () => {
    const means = [0.0, 1.6, 5.3, 10.2, 15.5, 20.8, 24.3, 23.3, 18.3, 12.0, 5.2, 0.6];
    const precip = [10, 9, 24, 36, 51, 33, 35, 30, 26, 20, 14, 8];
    expect(classifyKoppen(means, precip)).toBe('BSk');
  });

  // Tokyo, Japan — humid subtropical: hot summers, mild winters, year-round rain
  it('returns Cfa for Tokyo', () => {
    const means = [5.2, 5.7, 8.7, 13.9, 18.2, 21.4, 25.0, 26.4, 22.8, 17.5, 12.1, 7.6];
    const precip = [52, 56, 118, 125, 138, 168, 154, 168, 210, 197, 93, 51];
    expect(classifyKoppen(means, precip)).toBe('Cfa');
  });

  // Singapore — tropical rainforest: all months ≥ 18°C, heavy consistent rain
  it('returns Af for Singapore', () => {
    const means = [26.5, 27.1, 27.5, 28.0, 28.3, 28.1, 27.7, 27.7, 27.4, 27.2, 26.9, 26.5];
    const precip = [243, 112, 173, 188, 173, 130, 155, 154, 178, 154, 254, 257];
    expect(classifyKoppen(means, precip)).toBe('Af');
  });

  // Barrow (Utqiagvik), Alaska — tundra polar: all months < 10°C, warmest ~4°C
  it('returns ET for polar tundra (Barrow-like data)', () => {
    const means = [-25, -26, -23, -14, -4, 2, 4, 3, -1, -10, -19, -23];
    const precip = [6, 5, 4, 4, 5, 11, 22, 23, 16, 14, 10, 7];
    expect(classifyKoppen(means, precip)).toBe('ET');
  });
});

// ── deriveFrostDates ──────────────────────────────────────────────────────────

describe('deriveFrostDates', () => {
  it('returns null frost dates when no frost days recorded', () => {
    const records = [
      { date: '2023-01-15', minTemp: 5 },
      { date: '2023-07-15', minTemp: 18 },
    ];
    const result = deriveFrostDates(records);
    expect(result.lastFrostMonthDay).toBeNull();
    expect(result.firstFrostMonthDay).toBeNull();
  });

  it('identifies last spring frost and first autumn frost', () => {
    // Two years with frost in spring (April) and autumn (October)
    const records = [
      { date: '2022-04-10', minTemp: -1 },
      { date: '2022-04-15', minTemp: -2 }, // later spring frost in same year
      { date: '2022-10-05', minTemp: -0.5 },
      { date: '2023-04-12', minTemp: -1 },
      { date: '2023-10-08', minTemp: -0.5 },
    ];
    const result = deriveFrostDates(records);
    // Last spring frost: Apr 15 and Apr 12 → avg doy ≈ 4*30+13.5=133.5
    expect(result.lastFrostMonthDay).not.toBeNull();
    expect(result.lastFrostMonthDay).toMatch(/^\d{2}-\d{2}$/);
    // First autumn frost: Oct 5 and Oct 8 → should be in October
    expect(result.firstFrostMonthDay).not.toBeNull();
    expect(result.firstFrostMonthDay.startsWith('10')).toBe(true);
  });
});
