'use strict';

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { jsonrepair } = require('jsonrepair');
const vertexai = require('./vertexai');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ── Gemini API fetch patch ────────────────────────────────────────────────────
// The Gemini API sometimes embeds generated text that contains raw control
// characters (U+0000–U+001F) directly inside the JSON response envelope.
// These are illegal in JSON string values and cause response.json() to throw
// "Unterminated string in JSON at position N" before our parseGeminiJson ever runs.
//
// Fix: intercept every Gemini API response and run a state-machine sanitiser
// over the body that escapes raw control chars inside string values only,
// leaving structural whitespace untouched.
(function patchFetchForGemini() {
  const GEMINI_HOST = 'generativelanguage.googleapis.com';
  const NAMED = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };

  /** Escape raw control characters that appear inside JSON string literals. */
  function sanitiseJsonStrings(body) {
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (escaped) {
        out += c;
        escaped = false;
      } else if (c === '\\' && inString) {
        out += c;
        escaped = true;
      } else if (c === '"') {
        out += c;
        inString = !inString;
      } else if (inString && c.charCodeAt(0) < 0x20) {
        out += NAMED[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`;
      } else {
        out += c;
      }
    }
    return out;
  }

  const origFetch = globalThis.fetch;
  globalThis.fetch = async function patchedFetch(url, init) {
    const res = await origFetch(url, init);
    if (typeof url === 'string' && url.includes(GEMINI_HOST)) {
      const origText = res.text.bind(res);
      res.text = async () => sanitiseJsonStrings(await origText());
      res.json = async () => JSON.parse(await res.text());
    }
    return res;
  };
}());

// Structured JSON logger for Cloud Logging
const log = {
  info:  (msg, data) => console.log(JSON.stringify({ severity: 'INFO',    message: msg, ...data })),
  warn:  (msg, data) => console.warn(JSON.stringify({ severity: 'WARNING', message: msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ severity: 'ERROR',  message: msg, ...data })),
};

const db = new Firestore();
const storage = new Storage({
  serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL,
});
const IMAGES_BUCKET = process.env.IMAGES_BUCKET;

const DEFAULT_FLOORS = [
  { id: 'ground', name: 'Ground Floor', order: 0, type: 'interior', imageUrl: null },
  { id: 'garden', name: 'Garden', order: -1, type: 'outdoor', imageUrl: null },
];

// Extract the GCS object path from a full public URL or return as-is if already a path.
function gcsPath(urlOrPath) {
  if (!urlOrPath) return null;
  // Strip query params (signed URLs have ?X-Goog-* params)
  const clean = urlOrPath.split('?')[0];
  const prefix = `https://storage.googleapis.com/${IMAGES_BUCKET}/`;
  return clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
}

// Extract the authenticated user's Google `sub` from the request.
// In production, API Gateway verifies the JWT and injects `x-apigateway-api-userinfo`.
// In local dev, we decode the Bearer token payload directly (no re-verification needed
// since the Cloud Function is not publicly reachable without the API key).
function getUserSub(req) {
  const gatewayInfo = req.headers['x-apigateway-api-userinfo'];
  if (gatewayInfo) {
    try {
      const payload = JSON.parse(Buffer.from(gatewayInfo, 'base64').toString('utf-8'));
      if (payload.sub) return payload.sub;
    } catch {}
  }
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const parts = auth.slice(7).split('.');
      if (parts.length === 3) {
        const pad = parts[1].length % 4;
        const padded = parts[1] + (pad ? '='.repeat(4 - pad) : '');
        const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
        if (payload.sub) return payload.sub;
      }
    } catch {}
  }
  return null;
}

function requireUser(req, res, next) {
  const sub = getUserSub(req);
  if (!sub) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = sub;
  next();
}

function userPlants(userId) {
  return db.collection('users').doc(userId).collection('plants');
}

function userConfig(userId) {
  return db.collection('users').doc(userId).collection('config');
}

// Return a signed read URL valid for 1 hour, or null if no image.
async function signReadUrl(urlOrPath) {
  const path = gcsPath(urlOrPath);
  if (!path) return null;
  const [url] = await storage.bucket(IMAGES_BUCKET).file(path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
  });
  return url;
}

async function signPlantData(data) {
  if (data.imageUrl) data.imageUrl = await signReadUrl(data.imageUrl);
  if (data.photoLog?.length) {
    // Deduplicate by normalized URL path and sign valid entries
    const seen = new Set();
    const signed = [];
    for (const entry of data.photoLog) {
      if (!entry.url) continue;
      const norm = entry.url.split('?')[0];
      if (seen.has(norm)) continue;
      seen.add(norm);
      const url = await signReadUrl(norm);
      if (url) signed.push({ ...entry, url });
    }
    data.photoLog = signed;
  }
  return data;
}

const app = express();
app.set('trust proxy', true); // Behind API Gateway — trust X-Forwarded-For
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: ['https://plants.lopezcloud.dev', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  optionsSuccessStatus: 204
}));
// Security headers
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-XSS-Protection', '0');
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Too many requests, please try again later.' },
}));
app.use((req, _res, next) => {
  log.info('request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const MAX_RETRIES = 2;

function friendlyGeminiError(err) {
  const msg = err.message || '';
  let friendly;
  if (msg.includes('503') || msg.includes('overloaded') || msg.includes('high demand')) {
    friendly = new Error('Our AI plant assistant is temporarily unavailable due to high demand. Please try again in a few moments.');
    friendly.status = 503;
  } else if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    friendly = new Error('Our AI plant assistant has received too many requests. Please wait a moment and try again.');
    friendly.status = 429;
  } else {
    return err;
  }
  log.error('gemini error', { originalError: msg });
  return friendly;
}

async function geminiWithRetry(request, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await gemini.generateContent(request);
    } catch (err) {
      if (attempt === retries) throw friendlyGeminiError(err);
      log.warn('gemini retry', { attempt: attempt + 1, error: err.message });
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}


const ANALYSE_FLOORPLAN_PROMPT = `Analyse this architectural floor plan image. Identify every distinct floor or level visible and the rooms/spaces on each.

Rules:
- type must be exactly "interior" or "outdoor"
- order: 0=ground floor, 1=first floor, 2=second floor, -1=outdoor/garden areas
- x, y, width, height are integer percentages (0-100) relative to that floor's bounding box
- All rooms must fit within 0-100 bounds
- Room names: concise English (e.g. "Living Room", "Kitchen", "Bathroom", "Hall", "Garage")
- Include outdoor/garden areas as a separate floor with type "outdoor"`;

// Strict response schema — Gemini structured output guarantees valid, complete JSON
const FLOORPLAN_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    floors: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:  { type: SchemaType.STRING },
          type:  { type: SchemaType.STRING },
          order: { type: SchemaType.INTEGER },
          rooms: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name:   { type: SchemaType.STRING },
                x:      { type: SchemaType.INTEGER },
                y:      { type: SchemaType.INTEGER },
                width:  { type: SchemaType.INTEGER },
                height: { type: SchemaType.INTEGER },
              },
              required: ['name', 'x', 'y', 'width', 'height'],
            },
          },
        },
        required: ['name', 'type', 'order', 'rooms'],
      },
    },
  },
  required: ['floors'],
};

// Parse Gemini JSON responses, handling common quirks:
//   • markdown code fences (```json ... ```)
//   • surrounding prose before/after the JSON object
//   • raw unescaped control characters (U+0000–U+001F) inside string values
//   • other malformed JSON (unescaped quotes, trailing commas, etc.) via jsonrepair
function parseGeminiJson(text) {
  if (!text || !text.trim()) throw new Error('Empty response from AI');
  let s = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  // Fast path: direct parse
  try { return JSON.parse(s); } catch (_e) {} // eslint-disable-line no-unused-vars

  // Extract the outermost {...} in case Gemini added surrounding prose
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end > start) s = s.slice(start, end + 1);

  // Sanitize ALL raw control characters (U+0000–U+001F) that are illegal
  // inside JSON strings. Named escapes are used for the five that have them;
  // everything else becomes a \uXXXX sequence.
  const NAMED = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };
  s = s.replace(/[\x00-\x1f]/g, c => NAMED[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

  try { return JSON.parse(s); } catch (_e) {} // eslint-disable-line no-unused-vars

  // Last resort: jsonrepair handles unescaped quotes, trailing commas, etc.
  log.warn('parseGeminiJson: falling back to jsonrepair', { raw: text.slice(0, 500) });
  return JSON.parse(jsonrepair(s));
}

const ANALYSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    species:         { type: SchemaType.STRING },
    frequencyDays:   { type: SchemaType.INTEGER },
    health:          { type: SchemaType.STRING },
    healthReason:    { type: SchemaType.STRING },
    maturity:        { type: SchemaType.STRING },
    recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    waterAmount:     { type: SchemaType.STRING },
    waterMethod:     { type: SchemaType.STRING },
    potSize:         { type: SchemaType.STRING },
    soilType:        { type: SchemaType.STRING },
  },
  required: ['species', 'frequencyDays', 'health', 'healthReason', 'maturity', 'recommendations'],
};

const ANALYSE_PROMPT = `Analyse this plant photo and respond ONLY with valid JSON matching this exact schema:
{
  "species": "Common Name (Scientific name) or null if unidentifiable",
  "frequencyDays": 7,
  "health": "Good",
  "healthReason": "One sentence reason",
  "maturity": "Mature",
  "recommendations": ["tip 1", "tip 2", "tip 3"],
  "waterAmount": "250ml",
  "waterMethod": "jug",
  "potSize": "medium",
  "soilType": "standard"
}
Rules:
- health must be exactly one of: Excellent, Good, Fair, Poor
- maturity must be exactly one of: Seedling, Young, Mature, Established
- frequencyDays is an integer 1-30 representing days between waterings — choose based on species needs:
  - Succulents & cacti: 10-21 days
  - Tropical foliage (Monstera, Pothos, Philodendron): 7-10 days
  - Ferns & calatheas (moisture-loving): 2-5 days
  - Herbs & annuals: 2-4 days
  - Snake plants, ZZ plants (drought-tolerant): 10-14 days
  - Flowering houseplants: 5-7 days
  - Outdoor garden plants: 2-5 days depending on type
  - Adjust DOWN for seedlings (need more frequent watering) and UP for established plants
- recommendations must have exactly 3 items
- waterAmount is the recommended amount of water per watering (e.g. "100ml", "250ml", "500ml", "1L") — scale with pot size
- waterMethod must be one of: jug, spray, bottom-water, hose, irrigation, drip
- Choose waterMethod based on plant type: small indoor plants = jug or spray, large indoor = jug or bottom-water, outdoor/garden = hose or irrigation
- potSize must be one of: small, medium, large, xlarge — estimate from the photo (small < 15cm, medium 15-25cm, large 25-40cm, xlarge > 40cm)
- soilType must be one of: standard, well-draining, moisture-retaining, succulent-mix, orchid-mix — choose the best match for the species
- Respond with JSON only, no markdown or extra text`;

const RECOMMEND_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    summary:      { type: SchemaType.STRING },
    watering:     { type: SchemaType.STRING },
    light:        { type: SchemaType.STRING },
    humidity:     { type: SchemaType.STRING },
    soil:         { type: SchemaType.STRING },
    temperature:  { type: SchemaType.STRING },
    fertilising:  { type: SchemaType.STRING },
    commonIssues: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    tips:         { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['summary', 'watering', 'light', 'humidity', 'soil', 'temperature', 'fertilising', 'commonIssues', 'tips'],
};

const RECOMMEND_PROMPT = (name, species, { plantedIn, isOutdoor } = {}) => {
  const context = [];
  if (plantedIn) context.push(`planted in: ${plantedIn === 'ground' ? 'the ground' : plantedIn === 'garden-bed' ? 'a garden bed' : 'a pot'}`);
  if (isOutdoor !== undefined) context.push(`location: ${isOutdoor ? 'outdoors' : 'indoors'}`);
  const extra = context.length ? `\nContext: ${context.join(', ')}.` : '';
  return `You are a plant care expert. Provide detailed care guidance for: ${name}${species ? ` (${species})` : ''}.${extra}
Rules:
- commonIssues and tips must each have 2–4 items
- Be concise and practical
- Tailor advice to the plant's specific planting situation (pot vs ground vs garden bed, indoor vs outdoor)`;
};

const WATERING_RECOMMEND_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    amount:       { type: SchemaType.STRING },
    frequency:    { type: SchemaType.STRING },
    method:       { type: SchemaType.STRING },
    seasonalTips: { type: SchemaType.STRING },
    signs:        { type: SchemaType.STRING },
    summary:      { type: SchemaType.STRING },
  },
  required: ['amount', 'frequency', 'method', 'seasonalTips', 'signs', 'summary'],
};

const WATERING_RECOMMEND_PROMPT = (name, species, { plantedIn, isOutdoor, potSize, soilType, sunExposure, health, season } = {}) => {
  const details = [];
  if (plantedIn) details.push(`planted in: ${plantedIn === 'ground' ? 'the ground' : plantedIn === 'garden-bed' ? 'a garden bed' : 'a pot'}`);
  if (isOutdoor !== undefined) details.push(`location: ${isOutdoor ? 'outdoors' : 'indoors'}`);
  if (potSize) details.push(`pot size: ${potSize}`);
  if (soilType) details.push(`soil: ${soilType}`);
  if (sunExposure) details.push(`sun exposure: ${sunExposure}`);
  if (health) details.push(`current health: ${health}`);
  if (season) details.push(`current season: ${season}`);
  const ctx = details.length ? `\nPlant details: ${details.join(', ')}.` : '';
  return `You are a plant watering expert. Provide specific watering guidance for: ${name}${species ? ` (${species})` : ''}.${ctx}
Rules:
- amount: specific volume (e.g. "200-300ml" for pots, "deep soak to 15cm" for ground)
- frequency: specific schedule (e.g. "every 5-7 days in summer")
- method: best watering method for this setup
- seasonalTips: how to adjust watering across seasons
- signs: how to tell if over/under-watered
- summary: one sentence overall recommendation
- Tailor all advice to the specific planting situation`;
};

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── ML status ────────────────────────────────────────────────────────────────

app.get('/ml/status', async (req, res) => {
  try {
    const status = await vertexai.checkStatus();
    const httpCode = status.status === 'ok' ? 200 : status.status === 'unconfigured' ? 503 : 502;
    res.status(httpCode).json(status);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ── ML feature engineering ────────────────────────────────────────────────────

function getSeason(dateStr) {
  const month = new Date(dateStr).getMonth(); // 0-indexed
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

function buildFeatureRows(plant) {
  const log = (plant.wateringLog || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (log.length < 2) return [];

  const healthLog = (plant.healthLog || []).sort((a, b) => new Date(a.date) - new Date(b.date));

  function healthAt(date) {
    const t = new Date(date).getTime();
    let h = null;
    for (const entry of healthLog) {
      if (new Date(entry.date).getTime() <= t) h = entry.health;
    }
    return h;
  }

  function healthAfter(date, days) {
    const target = new Date(date).getTime() + days * 86400000;
    return healthAt(new Date(target).toISOString());
  }

  const rows = [];
  for (let i = 1; i < log.length; i++) {
    const gap = (new Date(log[i].date) - new Date(log[i - 1].date)) / 86400000;
    const freq = plant.frequencyDays || 7;
    const adherence = +(gap / freq).toFixed(3);
    const health = healthAt(log[i].date);
    const health7d = healthAfter(log[i].date, 7);

    // Consecutive overdue: count how many previous gaps exceeded freq
    let consecutive = 0;
    for (let j = i; j >= 1; j--) {
      const g = (new Date(log[j].date) - new Date(log[j - 1].date)) / 86400000;
      if (g > freq) consecutive++;
      else break;
    }

    rows.push({
      species: plant.species || plant.name || '',
      days_between_waterings: +gap.toFixed(1),
      recommended_frequency: freq,
      adherence_ratio: adherence,
      health_at_watering: health || '',
      health_7d_after: health7d || '',
      season: getSeason(log[i].date),
      consecutive_overdue_days: consecutive,
      pot_size: plant.potSize || '',
      room: plant.room || '',
    });
  }
  return rows;
}

const CSV_COLUMNS = [
  'species', 'days_between_waterings', 'recommended_frequency',
  'adherence_ratio', 'health_at_watering', 'health_7d_after',
  'season', 'consecutive_overdue_days', 'pot_size', 'room',
];

function rowToCsv(row) {
  return CSV_COLUMNS.map(c => {
    const v = row[c] ?? '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

// Admin-gated ML export — produces NDJSON or CSV, optionally writes to GCS
app.get('/ml/export', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ML_ADMIN_TOKEN;
  if (!expectedToken || adminToken !== expectedToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const format = (req.query.format || 'ndjson').toLowerCase();
  if (format !== 'ndjson' && format !== 'csv') {
    return res.status(400).json({ error: 'format must be "ndjson" or "csv"' });
  }
  const dest = (req.query.dest || 'stream').toLowerCase();

  try {
    // Collect all feature rows
    const allRows = [];
    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
      const plantsSnap = await db.collection('users').doc(userDoc.id).collection('plants').get();
      for (const plantDoc of plantsSnap.docs) {
        allRows.push(...buildFeatureRows(plantDoc.data()));
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    let body;
    let contentType;
    let ext;

    if (format === 'csv') {
      const header = CSV_COLUMNS.join(',');
      body = header + '\n' + allRows.map(rowToCsv).join('\n') + (allRows.length ? '\n' : '');
      contentType = 'text/csv';
      ext = 'csv';
    } else {
      body = allRows.map(r => JSON.stringify(r)).join('\n') + (allRows.length ? '\n' : '');
      contentType = 'application/x-ndjson';
      ext = 'ndjson';
    }

    // Write to GCS if requested
    if (dest === 'gcs') {
      const bucket = process.env.ML_DATA_BUCKET || 'plant-tracker-ml-data';
      const filePath = `exports/${dateStr}.${ext}`;
      await storage.bucket(bucket).file(filePath).save(body, { contentType });
      return res.status(200).json({ written: `gs://${bucket}/${filePath}`, rows: allRows.length, format });
    }

    // Stream to response
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="features-${dateStr}.${ext}"`);
    res.write(body);
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

// ── Floorplan analysis via Gemini (Vertex AI) ────────────────────────────────

app.post('/analyse-floorplan', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: ANALYSE_FLOORPLAN_PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: FLOORPLAN_SCHEMA,
      },
    });

    const text = result.response.text();
    const parsed = parseGeminiJson(text);
    if (!Array.isArray(parsed.floors) || parsed.floors.length === 0) {
      return res.status(500).json({ error: 'No floors identified in floorplan' });
    }

    // Assign stable IDs based on name+order
    const floors = parsed.floors.map((f) => ({
      id: f.name.toLowerCase().replace(/\s+/g, '-'),
      name: f.name,
      type: f.type || 'interior',
      order: typeof f.order === 'number' ? f.order : 0,
      rooms: f.rooms || [],
      imageUrl: null,
    }));

    res.status(200).json({ floors });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Plant photo analysis via Gemini (Vertex AI) ───────────────────────────────

app.post('/analyse', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: ANALYSE_PROMPT },
        ],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: ANALYSE_SCHEMA },
    });

    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Care recommendations via Gemini ──────────────────────────────────────────

app.post('/recommend', async (req, res) => {
  try {
    const { name, species, plantedIn, isOutdoor } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [{ text: RECOMMEND_PROMPT(name, species, { plantedIn, isOutdoor }) }],
      }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: RECOMMEND_SCHEMA,
      },
    });

    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/recommend-watering', async (req, res) => {
  try {
    const { name, species, plantedIn, isOutdoor, potSize, soilType, sunExposure, health, season } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [{ text: WATERING_RECOMMEND_PROMPT(name, species, { plantedIn, isOutdoor, potSize, soilType, sunExposure, health, season }) }],
      }],
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: WATERING_RECOMMEND_SCHEMA,
      },
    });

    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Image upload — returns a signed URL so the browser can PUT directly to GCS

const VALID_FILENAME = /^(plants|floorplans)\/[a-f0-9-]{36}\.[a-z0-9]+$/i;

app.post('/images/upload-url', requireUser, async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }
    if (!VALID_FILENAME.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }

    const [uploadUrl] = await storage
      .bucket(IMAGES_BUCKET)
      .file(filename)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      });

    const publicUrl = `https://storage.googleapis.com/${IMAGES_BUCKET}/${filename}`;
    res.status(200).json({ uploadUrl, publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Floors config ─────────────────────────────────────────────────────────────

app.get('/config/floors', requireUser, async (req, res) => {
  try {
    const doc = await userConfig(req.userId).doc('floors').get();
    const floors = doc.exists ? doc.data().floors : DEFAULT_FLOORS;
    const signed = await Promise.all(floors.map(async (f) => ({
      ...f,
      imageUrl: f.imageUrl ? await signReadUrl(f.imageUrl) : null,
    })));
    res.status(200).json({ floors: signed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/config/floors', requireUser, async (req, res) => {
  try {
    const { floors } = req.body;
    await userConfig(req.userId).doc('floors').set(
      { floors, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    const signed = await Promise.all(floors.map(async (f) => ({
      ...f,
      imageUrl: f.imageUrl ? await signReadUrl(f.imageUrl) : null,
    })));
    res.status(200).json({ floors: signed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Floorplan config (legacy) ──────────────────────────────────────────────────────────

app.get('/config/floorplan', requireUser, async (req, res) => {
  try {
    const doc = await userConfig(req.userId).doc('floorplan').get();
    const data = doc.exists ? doc.data() : { imageUrl: null };
    await signPlantData(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/config/floorplan', requireUser, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    await userConfig(req.userId).doc('floorplan').set(
      { imageUrl, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    const signedUrl = await signReadUrl(imageUrl);
    res.status(200).json({ imageUrl: signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plants CRUD ───────────────────────────────────────────────────────────────

app.get('/plants', requireUser, async (req, res) => {
  try {
    const snapshot = await userPlants(req.userId)
      .orderBy('createdAt', 'desc')
      .get();
    const plants = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        await signPlantData(data);
        return data;
      })
    );
    res.status(200).json(plants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants', requireUser, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { imageBase64: _img, ...body } = req.body;
    if (body.imageUrl) {
      try { body.imageUrl = body.imageUrl.split('?')[0]; } catch {}
      body.photoLog = [{ url: body.imageUrl, date: now, type: 'growth', analysis: null }];
    }
    const data = { ...body, createdAt: now, updatedAt: now };
    const docRef = await userPlants(req.userId).add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/plants/:id', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const data = { id: doc.id, ...doc.data() };
    await signPlantData(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/plants/:id', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { imageBase64: _img, ...body } = req.body;
    const now = new Date().toISOString();
    const existing = doc.data();

    // Normalize imageUrl: strip signed-URL query params so we always store
    // the raw GCS public URL (prevents phantom photoLog entries on every save)
    if (body.imageUrl) {
      try { body.imageUrl = body.imageUrl.split('?')[0]; } catch {}
    }

    const updates = { ...body, updatedAt: now };

    // Track health changes in healthLog
    if (body.health && body.health !== existing.health) {
      const healthLog = [...(existing.healthLog || []), {
        date: now,
        health: body.health,
        reason: body.healthReason || '',
      }];
      updates.healthLog = healthLog;

      // Invalidate health-related ML caches
      const mlCache = { ...(existing.mlCache || {}) };
      delete mlCache.healthPrediction;
      delete mlCache.wateringPattern;
      updates.mlCache = mlCache;
    }

    // Add images to photoLog for growth history
    if (body.imageUrl) {
      const newImageNorm = body.imageUrl.split('?')[0];
      const existingImageNorm = existing.imageUrl ? existing.imageUrl.split('?')[0] : null;
      const photoLog = [...(existing.photoLog || [])];
      // Push old image if being replaced
      if (existingImageNorm && newImageNorm !== existingImageNorm) {
        const alreadyInLog = photoLog.some((e) => e.url?.split('?')[0] === existingImageNorm);
        if (!alreadyInLog) {
          photoLog.push({ url: existingImageNorm, date: existing.updatedAt || new Date().toISOString(), type: 'growth', analysis: null });
        }
      }
      // Always push new image to photoLog
      const newAlreadyInLog = photoLog.some((e) => e.url?.split('?')[0] === newImageNorm);
      if (!newAlreadyInLog) {
        photoLog.push({ url: newImageNorm, date: new Date().toISOString(), type: 'growth', analysis: null });
      }
      updates.photoLog = photoLog;
    }

    await ref.set(updates, { merge: true });

    const updated = await ref.get();
    res.status(200).json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/water', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const now = new Date().toISOString();
    const existing = doc.data();
    const { amount, method } = req.body || {};
    const wateringLog = [...(existing.wateringLog || []), { date: now, note: '', amount: amount || null, method: method || null }];

    // Invalidate ML caches on new watering event
    const mlCache = { ...(existing.mlCache || {}) };
    delete mlCache.wateringPattern;
    delete mlCache.wateringRecommendation;
    delete mlCache.healthPrediction;
    await ref.set({ lastWatered: now, wateringLog, updatedAt: now, mlCache }, { merge: true });

    const updated = await ref.get();
    const data = { id: updated.id, ...updated.data() };
    await signPlantData(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plant diagnostic photo analysis ──────────────────────────────────────────

const DIAGNOSTIC_PROMPT = `Analyse this photo of a plant issue and respond ONLY with valid JSON:
{
  "issue": "Brief description of the problem",
  "severity": "mild|moderate|severe",
  "cause": "Most likely cause",
  "treatment": "Recommended treatment in 1-2 sentences",
  "preventionTips": ["tip 1", "tip 2"]
}
Rules:
- Look for signs of disease, pests, nutrient deficiency, overwatering, underwatering, sunburn, etc.
- severity must be exactly one of: mild, moderate, severe
- preventionTips should have 2 items
- Respond with JSON only, no markdown or extra text`;

app.post('/plants/:id/diagnostic', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    // Upload diagnostic image to GCS
    const ext = mimeType.split('/')[1] || 'jpg';
    const filename = `diagnostics/${crypto.randomUUID()}.${ext}`;
    const file = storage.bucket(IMAGES_BUCKET).file(filename);
    const buffer = Buffer.from(imageBase64, 'base64');
    await file.save(buffer, { contentType: mimeType, resumable: false });
    const publicUrl = `https://storage.googleapis.com/${IMAGES_BUCKET}/${filename}`;

    // Analyse with Gemini
    let analysis = null;
    try {
      const result = await geminiWithRetry({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: DIAGNOSTIC_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      });
      analysis = parseGeminiJson(result.response.text());
    } catch (err) {
      console.error('Diagnostic analysis failed:', err.message);
    }

    // Append to photoLog
    const existing = doc.data();
    const photoLog = [...(existing.photoLog || [])];
    const entry = { url: publicUrl, date: new Date().toISOString(), type: 'diagnostic', analysis };
    photoLog.push(entry);

    await ref.set({ photoLog, updatedAt: new Date().toISOString() }, { merge: true });

    res.status(200).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Watering pattern analysis (heuristic, ML-replaceable) ─────────────────────

function analyseWateringPattern(plant) {
  const log = plant.wateringLog || [];
  if (log.length < 3) return { pattern: 'insufficient_data', confidence: 0, contributingFactors: ['Need at least 3 watering events for analysis'] };

  const sorted = [...log].sort((a, b) => new Date(a.date) - new Date(b.date));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000);
  }

  const freq = plant.frequencyDays || 7;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const std = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  const adherence = mean / freq;
  const cv = mean > 0 ? std / mean : 0; // coefficient of variation

  const healthLog = plant.healthLog || [];
  const healthDeclined = healthLog.length >= 2 &&
    ['Poor', 'Fair'].includes(healthLog[healthLog.length - 1]?.health) &&
    ['Excellent', 'Good'].includes(healthLog[0]?.health);

  const factors = [];
  let pattern = 'optimal';
  let confidence;

  if (cv > 0.5) {
    pattern = 'inconsistent';
    confidence = Math.min(0.95, 0.6 + cv * 0.2);
    factors.push(`High watering variability (${std.toFixed(1)} day std dev)`);
    factors.push(`Gaps range from ${Math.min(...gaps).toFixed(0)} to ${Math.max(...gaps).toFixed(0)} days`);
  } else if (adherence < 0.6 && healthDeclined) {
    pattern = 'over_watered';
    confidence = Math.min(0.9, 0.5 + (1 - adherence) * 0.4);
    factors.push(`Watering every ${mean.toFixed(1)}d vs recommended ${freq}d`);
    factors.push('Health has declined since tracking began');
  } else if (adherence > 1.5 && healthDeclined) {
    pattern = 'under_watered';
    confidence = Math.min(0.9, 0.5 + (adherence - 1) * 0.3);
    factors.push(`Watering every ${mean.toFixed(1)}d vs recommended ${freq}d`);
    factors.push('Health has declined since tracking began');
  } else if (adherence < 0.6) {
    pattern = 'over_watered';
    confidence = 0.5;
    factors.push(`Watering more often than recommended (every ${mean.toFixed(1)}d vs ${freq}d)`);
  } else if (adherence > 1.5) {
    pattern = 'under_watered';
    confidence = 0.5;
    factors.push(`Watering less often than recommended (every ${mean.toFixed(1)}d vs ${freq}d)`);
  } else {
    confidence = Math.min(0.95, 0.6 + (1 - Math.abs(1 - adherence)) * 0.3);
    factors.push(`Watering frequency closely matches recommendation`);
    if (!healthDeclined) factors.push('Health has been stable or improving');
  }

  return { pattern, confidence: +confidence.toFixed(2), contributingFactors: factors };
}

const ML_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isCacheValid(cache, key) {
  if (!cache || !cache[key]) return false;
  const age = Date.now() - new Date(cache[key].cachedAt).getTime();
  return age < ML_CACHE_TTL_MS;
}

app.get('/plants/:id/watering-pattern', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const mlCache = plant.mlCache || {};

    // Return cached result if fresh
    if (isCacheValid(mlCache, 'wateringPattern')) {
      return res.status(200).json(mlCache.wateringPattern.result);
    }

    // Try Vertex AI prediction if endpoint is configured
    const endpointId = process.env.WATERING_PATTERN_ENDPOINT;
    let result;
    if (endpointId && (plant.wateringLog || []).length >= 3) {
      try {
        const featureRows = buildFeatureRows(plant);
        if (featureRows.length > 0) {
          const predictions = await vertexai.predict(endpointId, [featureRows[featureRows.length - 1]]);
          if (predictions.length > 0 && predictions[0].pattern) {
            result = {
              pattern: predictions[0].pattern,
              confidence: predictions[0].confidence || 0.8,
              contributingFactors: predictions[0].contributingFactors || [],
              source: 'vertex_ai',
            };
          }
        }
      } catch (err) {
        log.warn('Vertex AI watering pattern prediction failed, falling back to heuristic', { error: err.message });
      }
    }

    // Fall back to heuristic
    if (!result) {
      result = { ...analyseWateringPattern(plant), source: 'heuristic' };
    }

    // Cache the result
    await ref.set({
      mlCache: { ...mlCache, wateringPattern: { result, cachedAt: new Date().toISOString() } }
    }, { merge: true });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Smart watering recommendations ──────────────────────────────────────────

const RECOMMENDATION_CACHE_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

app.get('/plants/:id/watering-recommendation', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const mlCache = plant.mlCache || {};

    // Return cached result if fresh (48h TTL)
    if (mlCache.wateringRecommendation) {
      const age = Date.now() - new Date(mlCache.wateringRecommendation.cachedAt).getTime();
      if (age < RECOMMENDATION_CACHE_TTL_MS) {
        return res.status(200).json(mlCache.wateringRecommendation.result);
      }
    }

    const endpointId = process.env.WATERING_RECOMMENDATION_ENDPOINT;
    let result;

    if (endpointId && (plant.wateringLog || []).length >= 5) {
      try {
        const featureRows = buildFeatureRows(plant);
        if (featureRows.length > 0) {
          const latest = featureRows[featureRows.length - 1];
          const predictions = await vertexai.predict(endpointId, [{
            ...latest,
            current_health: plant.health || '',
            pot_size: plant.potSize || '',
          }]);

          if (predictions.length > 0 && predictions[0].recommendedFrequencyDays) {
            const pred = predictions[0];
            const lastWatered = plant.lastWatered || plant.wateringLog?.slice(-1)[0]?.date;
            const nextDate = lastWatered
              ? new Date(new Date(lastWatered).getTime() + pred.recommendedFrequencyDays * 86400000).toISOString().slice(0, 10)
              : null;

            result = {
              recommendedFrequencyDays: pred.recommendedFrequencyDays,
              confidenceInterval: pred.confidenceInterval || [pred.recommendedFrequencyDays - 1, pred.recommendedFrequencyDays + 1],
              basis: pred.basis || `Based on care history for ${plant.species || plant.name}`,
              nextWateringDate: nextDate,
              source: 'vertex_ai',
            };
          }
        }
      } catch (err) {
        log.warn('Vertex AI watering recommendation failed, using heuristic', { error: err.message });
      }
    }

    // Heuristic fallback: use current frequencyDays with minor adjustments based on health
    if (!result) {
      const freq = plant.frequencyDays || 7;
      const healthLog = plant.healthLog || [];
      const lastHealth = healthLog.length > 0 ? healthLog[healthLog.length - 1].health : plant.health;

      let recommended = freq;
      let note = `Based on your current ${freq}-day schedule`;
      if (lastHealth === 'Poor' || lastHealth === 'Fair') {
        // Check if over- or under-watering via pattern analysis
        const pattern = analyseWateringPattern(plant);
        if (pattern.pattern === 'over_watered') {
          recommended = Math.min(30, Math.round(freq * 1.3));
          note = `${plant.species || plant.name} may be over-watered — try extending to every ${recommended} days`;
        } else if (pattern.pattern === 'under_watered') {
          recommended = Math.max(1, Math.round(freq * 0.7));
          note = `${plant.species || plant.name} may need more water — try every ${recommended} days`;
        }
      }

      const lastWatered = plant.lastWatered || plant.wateringLog?.slice(-1)[0]?.date;
      const nextDate = lastWatered
        ? new Date(new Date(lastWatered).getTime() + recommended * 86400000).toISOString().slice(0, 10)
        : null;

      result = {
        recommendedFrequencyDays: recommended,
        confidenceInterval: [Math.max(1, recommended - 1), recommended + 1],
        basis: note,
        nextWateringDate: nextDate,
        source: 'heuristic',
      };
    }

    // Cache the result
    await ref.set({
      mlCache: { ...mlCache, wateringRecommendation: { result, cachedAt: new Date().toISOString() } }
    }, { merge: true });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plant health prediction ──────────────────────────────────────────────────

const HEALTH_RANK = { Excellent: 4, Good: 3, Fair: 2, Poor: 1 };
const HEALTH_FROM_RANK = { 4: 'Excellent', 3: 'Good', 2: 'Fair', 1: 'Poor' };

function predictHealthHeuristic(plant) {
  const healthLog = (plant.healthLog || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  const currentHealth = healthLog.length > 0 ? healthLog[healthLog.length - 1].health : plant.health || 'Good';
  const currentRank = HEALTH_RANK[currentHealth] || 3;

  const keyRisks = [];
  let trendSlope = 0;

  if (healthLog.length >= 2) {
    const recent = healthLog.slice(-5);
    const ranks = recent.map(h => HEALTH_RANK[h.health] || 3);
    trendSlope = (ranks[ranks.length - 1] - ranks[0]) / recent.length;
  }

  // Check watering adherence
  const pattern = analyseWateringPattern(plant);
  if (pattern.pattern === 'over_watered') {
    keyRisks.push('Over-watering may lead to root rot');
    trendSlope -= 0.2;
  } else if (pattern.pattern === 'under_watered') {
    keyRisks.push('Under-watering is stressing the plant');
    trendSlope -= 0.2;
  } else if (pattern.pattern === 'inconsistent') {
    keyRisks.push('Inconsistent watering schedule causes stress');
    trendSlope -= 0.1;
  }

  // Check days since last watered
  const lastWatered = plant.lastWatered || (plant.wateringLog || []).slice(-1)[0]?.date;
  if (lastWatered) {
    const daysSince = (Date.now() - new Date(lastWatered).getTime()) / 86400000;
    const freq = plant.frequencyDays || 7;
    if (daysSince > freq * 2) {
      keyRisks.push(`Not watered in ${Math.round(daysSince)} days (recommended: every ${freq} days)`);
      trendSlope -= 0.3;
    }
  }

  if (keyRisks.length === 0) keyRisks.push('No significant risk factors detected');

  // Project health 14 days out
  const projectedRank = Math.max(1, Math.min(4, Math.round(currentRank + trendSlope * 2)));
  const predictedHealth = HEALTH_FROM_RANK[projectedRank];
  const trend = trendSlope > 0.1 ? 'improving' : trendSlope < -0.1 ? 'declining' : 'stable';

  return {
    predictedHealth,
    probability: trendSlope === 0 ? 0.7 : Math.min(0.85, 0.5 + Math.abs(trendSlope) * 0.5),
    horizon: '14d',
    trend,
    keyRisks,
    source: 'heuristic',
  };
}

app.get('/plants/:id/health-prediction', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const mlCache = plant.mlCache || {};

    // Return cached result if fresh
    if (isCacheValid(mlCache, 'healthPrediction')) {
      return res.status(200).json(mlCache.healthPrediction.result);
    }

    const endpointId = process.env.HEALTH_PREDICTION_ENDPOINT;
    let result;

    if (endpointId && (plant.wateringLog || []).length >= 3) {
      try {
        const featureRows = buildFeatureRows(plant);
        if (featureRows.length > 0) {
          const latest = featureRows[featureRows.length - 1];
          const predictions = await vertexai.predict(endpointId, [{
            ...latest,
            current_health: plant.health || '',
            health_trend_30d: (plant.healthLog || []).length >= 2 ? 'available' : 'insufficient',
          }]);

          if (predictions.length > 0 && predictions[0].predictedHealth) {
            const pred = predictions[0];
            result = {
              predictedHealth: pred.predictedHealth,
              probability: pred.probability || 0.75,
              horizon: '14d',
              trend: pred.trend || 'stable',
              keyRisks: pred.keyRisks || [],
              source: 'vertex_ai',
            };
          }
        }
      } catch (err) {
        log.warn('Vertex AI health prediction failed, falling back to heuristic', { error: err.message });
      }
    }

    if (!result) {
      result = predictHealthHeuristic(plant);
    }

    // Cache for 24 hours
    await ref.set({
      mlCache: { ...mlCache, healthPrediction: { result, cachedAt: new Date().toISOString() } }
    }, { merge: true });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Seasonal pattern recognition ─────────────────────────────────────────────

function getSeasonForHemisphere(date, hemisphere) {
  const month = new Date(date).getMonth(); // 0-indexed
  const isNorth = hemisphere !== 'south';

  if (isNorth) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
  // Southern hemisphere: seasons are reversed
  if (month >= 2 && month <= 4) return 'autumn';
  if (month >= 5 && month <= 7) return 'winter';
  if (month >= 8 && month <= 10) return 'spring';
  return 'summer';
}

// Default seasonal multipliers per season (species-independent baseline)
const SEASONAL_MULTIPLIERS = {
  spring: 1.0,
  summer: 1.3,
  autumn: 0.85,
  winter: 0.7,
};

function computeSeasonalAdjustment(plant, hemisphere) {
  const now = new Date();
  const season = getSeasonForHemisphere(now, hemisphere);
  const multiplier = SEASONAL_MULTIPLIERS[season];
  const freq = plant.frequencyDays || 7;
  const adjustedFreq = Math.max(1, Math.round(freq * (1 / multiplier)));
  // multiplier > 1 means plant needs MORE water → shorter interval
  // multiplier < 1 means plant needs LESS water → longer interval

  const species = plant.species || plant.name;
  const notes = {
    spring: `${species} is entering active growth — maintain regular watering`,
    summer: `${species} typically needs ~30% more water in summer due to heat and growth`,
    autumn: `${species} is slowing down — reduce watering by ~15%`,
    winter: `${species} typically needs ~30% less water in winter dormancy`,
  };

  return {
    season,
    multiplier,
    adjustedFrequencyDays: adjustedFreq,
    note: notes[season],
    source: 'heuristic',
  };
}

app.get('/plants/:id/seasonal-adjustment', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();

    // Get hemisphere from user config or default to north
    let hemisphere = 'north';
    try {
      const configDoc = await userConfig(req.userId).doc('preferences').get();
      if (configDoc.exists && configDoc.data().hemisphere) {
        hemisphere = configDoc.data().hemisphere;
      }
    } catch { /* default to north */ }

    const endpointId = process.env.SEASONAL_ADJUSTMENT_ENDPOINT;
    let result;

    if (endpointId && (plant.wateringLog || []).length >= 5) {
      try {
        const season = getSeasonForHemisphere(new Date(), hemisphere);
        const predictions = await vertexai.predict(endpointId, [{
          species: plant.species || plant.name || '',
          season,
          hemisphere,
        }]);

        if (predictions.length > 0 && predictions[0].multiplier) {
          const pred = predictions[0];
          const freq = plant.frequencyDays || 7;
          result = {
            season,
            multiplier: pred.multiplier,
            adjustedFrequencyDays: Math.max(1, Math.round(freq * (1 / pred.multiplier))),
            note: pred.note || `Seasonal adjustment for ${plant.species || plant.name}`,
            source: 'vertex_ai',
          };
        }
      } catch (err) {
        log.warn('Vertex AI seasonal adjustment failed, using heuristic', { error: err.message });
      }
    }

    if (!result) {
      result = computeSeasonalAdjustment(plant, hemisphere);
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Care optimisation score ──────────────────────────────────────────────────

function computeCareScore(plant) {
  const wlog = (plant.wateringLog || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  const healthLog = (plant.healthLog || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  const freq = plant.frequencyDays || 7;

  // Consistency (30%): low variance in watering intervals
  let consistency = 50;
  if (wlog.length >= 3) {
    const gaps = [];
    for (let i = 1; i < wlog.length; i++) {
      gaps.push((new Date(wlog[i].date) - new Date(wlog[i - 1].date)) / 86400000);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const std = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    const cv = mean > 0 ? std / mean : 0;
    consistency = Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
  }

  // Timing (30%): adherence to recommended frequency
  let timing = 50;
  if (wlog.length >= 2) {
    const gaps = [];
    for (let i = 1; i < wlog.length; i++) {
      gaps.push((new Date(wlog[i].date) - new Date(wlog[i - 1].date)) / 86400000);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const deviation = Math.abs(mean - freq) / freq;
    timing = Math.max(0, Math.min(100, Math.round(100 * (1 - deviation))));
  }

  // Health outcome (25%): recent health trend
  let healthOutcome = 50;
  if (healthLog.length >= 1) {
    const recent = healthLog.slice(-3);
    const avg = recent.reduce((sum, h) => sum + (HEALTH_RANK[h.health] || 3), 0) / recent.length;
    healthOutcome = Math.round((avg / 4) * 100);
  }

  // Responsiveness (15%): how quickly issues are addressed
  let responsiveness = 70; // default: assume OK
  if (healthLog.length >= 2) {
    const declines = [];
    for (let i = 1; i < healthLog.length; i++) {
      const prev = HEALTH_RANK[healthLog[i - 1].health] || 3;
      const curr = HEALTH_RANK[healthLog[i].health] || 3;
      if (curr > prev) {
        // Recovery detected
        const recoveryTime = (new Date(healthLog[i].date) - new Date(healthLog[i - 1].date)) / 86400000;
        declines.push(recoveryTime);
      }
    }
    if (declines.length > 0) {
      const avgRecovery = declines.reduce((a, b) => a + b, 0) / declines.length;
      responsiveness = Math.max(0, Math.min(100, Math.round(100 * Math.max(0, 1 - avgRecovery / 30))));
    }
  }

  const score = Math.round(consistency * 0.3 + timing * 0.3 + healthOutcome * 0.25 + responsiveness * 0.15);

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 75) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 45) grade = 'D';
  else grade = 'F';

  return {
    score,
    grade,
    dimensions: { consistency, timing, healthOutcome, responsiveness },
    trend: 0,
    scoredAt: new Date().toISOString(),
    source: 'heuristic',
  };
}

app.get('/plants/:id/care-score', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const mlCache = plant.mlCache || {};

    // Return cached result if fresh
    if (isCacheValid(mlCache, 'careScore')) {
      return res.status(200).json(mlCache.careScore.result);
    }

    const endpointId = process.env.CARE_SCORE_ENDPOINT;
    let result;

    if (endpointId && (plant.wateringLog || []).length >= 3) {
      try {
        const featureRows = buildFeatureRows(plant);
        if (featureRows.length > 0) {
          const predictions = await vertexai.predict(endpointId, [featureRows[featureRows.length - 1]]);
          if (predictions.length > 0 && typeof predictions[0].score === 'number') {
            result = { ...predictions[0], source: 'vertex_ai', scoredAt: new Date().toISOString() };
          }
        }
      } catch (err) {
        log.warn('Vertex AI care score failed, using heuristic', { error: err.message });
      }
    }

    if (!result) {
      result = computeCareScore(plant);
    }

    // Cache
    await ref.set({
      mlCache: { ...mlCache, careScore: { result, cachedAt: new Date().toISOString() } }
    }, { merge: true });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aggregate care scores for all plants (worst-first)
app.get('/ml/care-scores', requireUser, async (req, res) => {
  try {
    const snapshot = await userPlants(req.userId).get();
    const scores = [];

    for (const doc of snapshot.docs) {
      const plant = doc.data();
      const cached = plant.mlCache?.careScore?.result;
      const score = cached || computeCareScore(plant);
      scores.push({
        plantId: doc.id,
        name: plant.name,
        species: plant.species,
        ...score,
      });
    }

    scores.sort((a, b) => a.score - b.score); // worst first
    res.status(200).json(scores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Species clustering ───────────────────────────────────────────────────────

// Default cluster assignments based on common plant care patterns
const DEFAULT_CLUSTERS = {
  'thirsty_tropicals': {
    id: 'thirsty_tropicals', label: 'Thirsty Tropicals',
    species: ['fern', 'calathea', 'peace lily', 'spathiphyllum', 'nephrolepis', 'maidenhair', 'boston fern', 'bird of paradise', 'alocasia'],
    careProfile: { avgFrequency: 5, droughtTolerance: 'low', humidityNeed: 'high' },
  },
  'forgiving_foliage': {
    id: 'forgiving_foliage', label: 'Forgiving Foliage',
    species: ['pothos', 'philodendron', 'monstera', 'zz plant', 'zamioculcas', 'rubber plant', 'ficus', 'spider plant', 'dracaena', 'dieffenbachia'],
    careProfile: { avgFrequency: 8, droughtTolerance: 'medium', humidityNeed: 'medium' },
  },
  'drought_tolerant': {
    id: 'drought_tolerant', label: 'Drought Tolerant',
    species: ['cactus', 'succulent', 'snake plant', 'sansevieria', 'aloe', 'jade', 'crassula', 'echeveria', 'haworthia', 'agave'],
    careProfile: { avgFrequency: 14, droughtTolerance: 'high', humidityNeed: 'low' },
  },
  'seasonal_bloomers': {
    id: 'seasonal_bloomers', label: 'Seasonal Bloomers',
    species: ['orchid', 'phalaenopsis', 'christmas cactus', 'cyclamen', 'african violet', 'begonia', 'anthurium', 'bromeliad'],
    careProfile: { avgFrequency: 7, droughtTolerance: 'medium', humidityNeed: 'high' },
  },
};

function findClusterForSpecies(speciesName) {
  if (!speciesName) return null;
  const lower = speciesName.toLowerCase();
  for (const cluster of Object.values(DEFAULT_CLUSTERS)) {
    if (cluster.species.some(s => lower.includes(s) || s.includes(lower))) {
      const similarSpecies = cluster.species.filter(s => s !== lower).slice(0, 5);
      return {
        clusterId: cluster.id,
        clusterLabel: cluster.label,
        similarSpecies,
        clusterCareProfile: cluster.careProfile,
        source: 'default',
      };
    }
  }
  return null;
}

app.get('/species/:name/cluster', requireUser, async (req, res) => {
  try {
    const speciesName = decodeURIComponent(req.params.name);

    // Check GCS cluster assignments if available
    const endpointId = process.env.SPECIES_CLUSTER_ENDPOINT;
    if (endpointId) {
      try {
        const predictions = await vertexai.predict(endpointId, [{ species: speciesName }]);
        if (predictions.length > 0 && predictions[0].clusterId) {
          return res.status(200).json({ ...predictions[0], source: 'vertex_ai' });
        }
      } catch (err) {
        log.warn('Vertex AI species cluster lookup failed, using defaults', { error: err.message });
      }
    }

    // Check Firestore config/clusters for cached assignments
    try {
      const clusterDoc = await db.collection('config').doc('clusters').get();
      if (clusterDoc.exists) {
        const assignments = clusterDoc.data().assignments || {};
        const lower = speciesName.toLowerCase();
        if (assignments[lower]) {
          return res.status(200).json({ ...assignments[lower], source: 'trained' });
        }
      }
    } catch { /* fall through to defaults */ }

    // Default cluster lookup
    const result = findClusterForSpecies(speciesName);
    if (result) {
      return res.status(200).json(result);
    }

    // Unknown species — return no cluster
    res.status(200).json({
      clusterId: null,
      clusterLabel: 'Unknown',
      similarSpecies: [],
      clusterCareProfile: null,
      source: 'none',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Anomaly detection ────────────────────────────────────────────────────────

function computeAnomalyFeatures(plant) {
  const wlog = (plant.wateringLog || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (wlog.length < 3) return null;

  // Rolling 30-day window
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const _recent = wlog.filter(w => new Date(w.date).getTime() > thirtyDaysAgo);
  const gaps = [];
  const sorted = [...wlog].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000);
  }

  if (gaps.length === 0) return null;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const std = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
  const maxGap = Math.max(...gaps);
  const freq = plant.frequencyDays || 7;
  const adherence = mean / freq;

  return {
    mean_days_between_waterings: +mean.toFixed(1),
    std_days_between_waterings: +std.toFixed(1),
    max_gap_days: +maxGap.toFixed(1),
    waterings_in_last_14d: wlog.filter(w => new Date(w.date).getTime() > Date.now() - 14 * 86400000).length,
    adherence_ratio_30d: +adherence.toFixed(3),
  };
}

function detectAnomalyHeuristic(plant) {
  const features = computeAnomalyFeatures(plant);
  if (!features) return { isAnomaly: false, score: 0, flags: [], detectedAt: null };

  const freq = plant.frequencyDays || 7;
  const flags = [];
  let score = 0;

  // Check for extreme gap
  if (features.max_gap_days > freq * 2.5) {
    score += 0.3;
    flags.push(`Longest gap was ${features.max_gap_days} days (recommended: every ${freq} days)`);
  }

  // Check for low recent activity
  if (features.waterings_in_last_14d === 0 && freq <= 14) {
    score += 0.3;
    flags.push('No watering events in the last 14 days');
  }

  // Check for high variance
  if (features.std_days_between_waterings > freq * 0.8) {
    score += 0.2;
    flags.push(`High watering variability (${features.std_days_between_waterings} day std dev)`);
  }

  // Check adherence
  if (features.adherence_ratio_30d > 2) {
    score += 0.2;
    flags.push(`Watering ${features.adherence_ratio_30d.toFixed(1)}x less often than recommended`);
  }

  score = Math.min(1, score);
  const threshold = parseFloat(process.env.ANOMALY_THRESHOLD) || 0.8;
  const isAnomaly = score >= threshold;

  return {
    isAnomaly,
    score: +score.toFixed(2),
    flags: flags.slice(0, 3),
    detectedAt: isAnomaly ? new Date().toISOString() : null,
  };
}

// Background job: scan all plants for anomalies (Cloud Scheduler target)
app.post('/ml/anomaly-scan', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ML_ADMIN_TOKEN;
  if (!expectedToken || adminToken !== expectedToken) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const endpointId = process.env.ANOMALY_DETECTION_ENDPOINT;
    const usersSnap = await db.collection('users').get();
    let scanned = 0;
    let anomalies = 0;

    for (const userDoc of usersSnap.docs) {
      const plantsSnap = await db.collection('users').doc(userDoc.id).collection('plants').get();
      for (const plantDoc of plantsSnap.docs) {
        const plant = plantDoc.data();
        let result;

        if (endpointId) {
          try {
            const features = computeAnomalyFeatures(plant);
            if (features) {
              const predictions = await vertexai.predict(endpointId, [features]);
              if (predictions.length > 0) {
                const threshold = parseFloat(process.env.ANOMALY_THRESHOLD) || 0.8;
                result = {
                  isAnomaly: (predictions[0].score || 0) >= threshold,
                  score: predictions[0].score || 0,
                  flags: predictions[0].flags || [],
                  detectedAt: new Date().toISOString(),
                };
              }
            }
          } catch (err) {
            log.warn('Vertex AI anomaly detection failed for plant, using heuristic', { plantId: plantDoc.id, error: err.message });
          }
        }

        if (!result) {
          result = detectAnomalyHeuristic(plant);
        }

        // Update mlCache
        const ref = db.collection('users').doc(userDoc.id).collection('plants').doc(plantDoc.id);
        await ref.set({
          mlCache: { ...(plant.mlCache || {}), anomaly: { result, cachedAt: new Date().toISOString() } }
        }, { merge: true });

        scanned++;
        if (result.isAnomaly) anomalies++;
      }
    }

    res.status(200).json({ scanned, anomalies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User-facing anomaly status
app.get('/plants/:id/anomaly', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const cached = plant.mlCache?.anomaly?.result;
    if (cached) {
      return res.status(200).json(cached);
    }

    // Compute on-demand if no cached result
    const result = detectAnomalyHeuristic(plant);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const { imageUrl } = doc.data();
    await ref.delete();
    if (imageUrl) {
      const path = gcsPath(imageUrl);
      if (path) await storage.bucket(IMAGES_BUCKET).file(path).delete().catch(() => {});
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

functions.http('plantsApi', app);
