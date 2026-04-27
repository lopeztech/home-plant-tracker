import { describe, it, expect } from 'vitest';
import { getGrowingSeason, koppenLabel } from '../utils/climate.js';

describe('getGrowingSeason', () => {
  it('returns null when climate is null', () => {
    expect(getGrowingSeason(null)).toBeNull();
  });

  it('returns null when neither frost date is set', () => {
    expect(getGrowingSeason({ lastFrostMonthDay: null, firstFrostMonthDay: null })).toBeNull();
  });

  it('returns a growing season range when both frost dates are present', () => {
    const gs = getGrowingSeason({ lastFrostMonthDay: '04-14', firstFrostMonthDay: '10-20' }, 2026);
    expect(gs).not.toBeNull();
    expect(gs.start).toBe('2026-04-14');
    expect(gs.end).toBe('2026-10-20');
    expect(gs.label).toContain('Growing season');
  });

  it('uses Jan 1 as start when last frost is missing', () => {
    const gs = getGrowingSeason({ lastFrostMonthDay: null, firstFrostMonthDay: '10-20' }, 2026);
    expect(gs.start).toBe('2026-01-01');
    expect(gs.end).toBe('2026-10-20');
  });

  it('uses Dec 31 as end when first autumn frost is missing', () => {
    const gs = getGrowingSeason({ lastFrostMonthDay: '03-10', firstFrostMonthDay: null }, 2026);
    expect(gs.start).toBe('2026-03-10');
    expect(gs.end).toBe('2026-12-31');
  });
});

describe('koppenLabel', () => {
  it('returns null for null input', () => {
    expect(koppenLabel(null)).toBeNull();
  });

  it('returns Tropical for A codes', () => {
    expect(koppenLabel('Af')).toBe('Tropical');
  });

  it('returns Semi-arid for BS codes', () => {
    expect(koppenLabel('BSk')).toBe('Semi-arid');
  });

  it('returns Arid for BW codes', () => {
    expect(koppenLabel('BWh')).toBe('Arid');
  });

  it('returns Temperate for C codes', () => {
    expect(koppenLabel('Cfb')).toBe('Temperate');
  });

  it('returns Continental for D codes', () => {
    expect(koppenLabel('Dfb')).toBe('Continental');
  });

  it('returns Polar/Arctic for E codes', () => {
    expect(koppenLabel('ET')).toBe('Polar/Arctic');
  });
});
