'use strict';

// Classify Köppen-Geiger climate type from 12 monthly mean temperatures (°C)
// and 12 monthly precipitation sums (mm). Returns a code like 'Cfb', 'BSk'.
function classifyKoppen(monthlyMeans, monthlyPrecip) {
  const tann = monthlyMeans.reduce((s, v) => s + v, 0) / 12;
  const tcold = Math.min(...monthlyMeans);
  const thot = Math.max(...monthlyMeans);
  const pann = monthlyPrecip.reduce((s, v) => s + v, 0);

  // Northern-biased split: warm half = Apr-Sep (indices 3-8)
  const warmHalfP = [3, 4, 5, 6, 7, 8].reduce((s, i) => s + monthlyPrecip[i], 0);
  const coldHalfP = pann - warmHalfP;
  let pthresh;
  if (warmHalfP >= 0.7 * pann) pthresh = 2 * tann + 28;
  else if (coldHalfP >= 0.7 * pann) pthresh = 2 * tann;
  else pthresh = 2 * tann + 14;

  // ── B: Arid ─────────────────────────────────────────────────────────────────
  if (pann < 10 * pthresh) {
    const subtype = pann >= 5 * pthresh ? 'S' : 'W';
    const hot = tann >= 18 ? 'h' : 'k';
    return `B${subtype}${hot}`;
  }

  // ── A: Tropical (all months ≥ 18 °C) ────────────────────────────────────────
  if (tcold >= 18) {
    const pmin = Math.min(...monthlyPrecip);
    if (pmin >= 60) return 'Af';
    if (pann >= 25 * (100 - pmin)) return 'Am';
    return 'Aw';
  }

  // Third letter for C and D
  function thirdLetter(thot, monthlyMeans) {
    if (thot >= 22) return 'a';
    const above10 = monthlyMeans.filter(t => t >= 10).length;
    if (above10 >= 4) return 'b';
    return 'c';
  }

  // Second letter (precip regime) for C and D
  function secondLetter(monthlyMeans, monthlyPrecip) {
    const indexed = monthlyMeans.map((t, i) => ({ t, p: monthlyPrecip[i] }));
    const sorted = [...indexed].sort((a, b) => b.t - a.t);
    const summerP = sorted.slice(0, 6).map(x => x.p);
    const winterP = sorted.slice(6).map(x => x.p);
    const psumMin  = Math.min(...summerP);
    const pwintMax = Math.max(...winterP);
    const pwintMin = Math.min(...winterP);
    const psumMax  = Math.max(...summerP);
    if (psumMin < pwintMax / 10 && psumMin < 30) return 'w';
    if (pwintMin < psumMax / 3 && pwintMin < 40) return 's';
    return 'f';
  }

  // ── C: Temperate (-3 ≤ Tcold < 18, Thot ≥ 10) ───────────────────────────────
  if (tcold >= -3 && thot >= 10) {
    return `C${secondLetter(monthlyMeans, monthlyPrecip)}${thirdLetter(thot, monthlyMeans)}`;
  }

  // ── D: Continental (Tcold < -3, Thot ≥ 10) ──────────────────────────────────
  if (thot >= 10) {
    const third = tcold < -38 ? 'd' : thirdLetter(thot, monthlyMeans);
    return `D${secondLetter(monthlyMeans, monthlyPrecip)}${third}`;
  }

  // ── E: Polar ─────────────────────────────────────────────────────────────────
  return thot >= 0 ? 'ET' : 'EF';
}

// Compute average last-spring-frost (Jan-Jun) and first-autumn-frost (Jul-Dec)
// from an array of { date: 'YYYY-MM-DD', minTemp: number } records.
function deriveFrostDates(dailyRecords) {
  const byYear = {};
  for (const { date, minTemp } of dailyRecords) {
    const [y, m, d] = date.split('-').map(Number);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push({ month: m, day: d, minTemp });
  }

  const springFrostDays = [];
  const autumnFrostDays = [];

  for (const days of Object.values(byYear)) {
    let lastSpring = null;
    for (const { month, day, minTemp } of days) {
      if (month >= 1 && month <= 6 && minTemp <= 0) {
        const doy = month * 30 + day;
        if (lastSpring === null || doy > lastSpring) lastSpring = doy;
      }
    }
    if (lastSpring !== null) springFrostDays.push(lastSpring);

    let firstAutumn = null;
    for (const { month, day, minTemp } of days) {
      if (month >= 7 && month <= 12 && minTemp <= 0) {
        const doy = month * 30 + day;
        if (firstAutumn === null || doy < firstAutumn) firstAutumn = doy;
      }
    }
    if (firstAutumn !== null) autumnFrostDays.push(firstAutumn);
  }

  function doyToMonthDay(avgDoy) {
    const month = Math.min(12, Math.max(1, Math.floor(avgDoy / 30)));
    const day   = Math.min(31, Math.max(1, Math.round(avgDoy - month * 30)));
    return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const lastFrostMonthDay = springFrostDays.length > 0
    ? doyToMonthDay(springFrostDays.reduce((s, v) => s + v, 0) / springFrostDays.length)
    : null;
  const firstFrostMonthDay = autumnFrostDays.length > 0
    ? doyToMonthDay(autumnFrostDays.reduce((s, v) => s + v, 0) / autumnFrostDays.length)
    : null;

  return { lastFrostMonthDay, firstFrostMonthDay };
}

module.exports = { classifyKoppen, deriveFrostDates };
