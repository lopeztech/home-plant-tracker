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
let jwt;
try { jwt = require('jsonwebtoken'); } catch { jwt = null; }

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

// Extract the authenticated user's identity claims from the request.
// In production, API Gateway verifies the JWT and injects `x-apigateway-api-userinfo`.
// In local dev, we decode the Bearer token payload directly (no re-verification needed
// since the Cloud Function is not publicly reachable without the API key).
function getUserClaims(req) {
  const gatewayInfo = req.headers['x-apigateway-api-userinfo'];
  if (gatewayInfo) {
    try {
      const payload = JSON.parse(Buffer.from(gatewayInfo, 'base64').toString('utf-8'));
      if (payload.sub) return { sub: payload.sub, name: payload.name || null, email: payload.email || null };
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
        if (payload.sub) return { sub: payload.sub, name: payload.name || null, email: payload.email || null };
      }
    } catch {}
  }
  return null;
}

const households = require('./households');

// Resolve the active household for the authenticated actor and decorate the
// request with: actorUserId, userId (= ownerId of the active household),
// householdId, role, actorDisplayName. Pre-existing handlers continue to use
// `req.userId` as the data-tree owner unchanged.
async function attachHouseholdContext(req, claims) {
  const displayName = claims.name || claims.email || null;
  const ctx = await households.resolveHouseholdContext(db, claims.sub, displayName);
  req.actorUserId = ctx.actorUserId;
  req.userId = ctx.userId;
  req.householdId = ctx.householdId;
  req.role = ctx.role;
  req.actorDisplayName = displayName;
}

function requireUser(req, res, next) {
  // Idempotent — the role-gate middleware below may have already resolved
  // household context for write requests; skip the second Firestore round-trip.
  if (req.actorUserId) return next();
  const claims = getUserClaims(req);
  if (!claims) return res.status(401).json({ error: 'Unauthorized' });
  attachHouseholdContext(req, claims).then(next).catch((err) => {
    log.error('household_context_failed', { error: err.message, sub: claims.sub });
    res.status(500).json({ error: 'Failed to resolve household context' });
  });
}

// For routes that accept anonymous callers but should still attribute usage
// to a user when an Authorization header is present (e.g. AI analyse during
// onboarding once Google sign-in has happened).
function softAuth(req, _res, next) {
  if (req.actorUserId) return next();
  const claims = getUserClaims(req);
  if (!claims) return next();
  attachHouseholdContext(req, claims).then(next).catch((err) => {
    log.warn('household_context_failed_soft', { error: err.message });
    next();
  });
}

function userPlants(userId) {
  return db.collection('users').doc(userId).collection('plants');
}

function userConfig(userId) {
  return db.collection('users').doc(userId).collection('config');
}

function userPropagations(userId) {
  return db.collection('users').doc(userId).collection('propagations');
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

const OUTDOOR_ROOMS = new Set(['Garden', 'Balcony', 'Outdoors', 'Patio', 'Terrace', 'Deck', 'Yard', 'Courtyard', 'Porch', 'Veranda']);

const billing = require('./billing');
const { createTierGate } = require('./tierGate');

const app = express();
app.set('trust proxy', true); // Behind API Gateway — trust X-Forwarded-For

// ── Stripe webhook — declared BEFORE app.use(express.json()) so we receive
// the raw request body for signature verification. Signature is checked via
// STRIPE_WEBHOOK_SECRET; the webhook deliberately has no api_key auth in the
// API Gateway spec.
app.post('/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = billing.getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).json({ error: 'billing_disabled' });

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  // Idempotency — Stripe may retry; use event.id as the dedup key.
  const eventRef = db.collection('stripeEvents').doc(event.id);
  const seen = await eventRef.get();
  if (seen.exists) return res.status(200).json({ received: true, duplicate: true });
  await eventRef.set({ type: event.type, receivedAt: new Date().toISOString() });

  try {
    await billing.applySubscriptionEvent(db, event);
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

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
  // If it still fails the raw error ("Object key expected at position N") is
  // useless to the user — surface a friendly message but keep the real cause
  // in server logs for debugging.
  log.warn('parseGeminiJson: falling back to jsonrepair', { raw: text.slice(0, 500) });
  try {
    return JSON.parse(jsonrepair(s));
  } catch (repairErr) {
    log.error('parseGeminiJson: jsonrepair failed', {
      repairError: repairErr.message,
      raw: text.slice(0, 500),
    });
    const friendly = new Error("The AI gave an unexpected response. Please try again in a moment.");
    friendly.status = 502;
    throw friendly;
  }
}

// Gemini sets finishReason: 'MAX_TOKENS' when it cut the response off at the
// configured limit. The JSON is guaranteed to be invalid in that case, so we
// fail loudly with a clearer message instead of surfacing a parse error.
function assertNotTruncated(result, label) {
  const reason = result?.response?.candidates?.[0]?.finishReason;
  if (reason === 'MAX_TOKENS') {
    log.error('gemini response truncated', { endpoint: label, finishReason: reason });
    const err = new Error("The AI response was too long and got cut off. Please try again.");
    err.status = 502;
    throw err;
  }
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

// Join "Sydney, Australia" or fall back to either half when one is missing.
function formatLocation(location) {
  if (!location) return '';
  const parts = [location.name, location.country].filter(Boolean);
  return parts.join(', ');
}

// Render a unit symbol regardless of whether the caller sent "C"/"F" or the
// full "°C"/"°F" symbol.
function tempSymbol(unit) {
  if (!unit) return '°C';
  const s = String(unit).toUpperCase();
  if (s.includes('F')) return '°F';
  return '°C';
}

const RECOMMEND_PROMPT = (name, species, { plantedIn, isOutdoor, location, tempUnit } = {}) => {
  const context = [];
  if (plantedIn) context.push(`planted in: ${plantedIn === 'ground' ? 'the ground' : plantedIn === 'garden-bed' ? 'a garden bed' : 'a pot'}`);
  if (isOutdoor !== undefined) context.push(`growing: ${isOutdoor ? 'outdoors' : 'indoors'}`);
  const loc = formatLocation(location);
  if (loc) context.push(`location: ${loc}`);
  const unit = tempSymbol(tempUnit);
  context.push(`preferred temperature unit: ${unit}`);
  const extra = context.length ? `\nContext: ${context.join(', ')}.` : '';
  return `You are a plant care expert. Provide detailed care guidance for: ${name}${species ? ` (${species})` : ''}.${extra}
Rules:
- commonIssues and tips must each have 2–4 items
- Be concise and practical
- Tailor advice to the plant's specific planting situation (pot vs ground vs garden bed, indoor vs outdoor)
- Tailor advice to the user's local climate based on the provided location. DO NOT reference USDA hardiness zones — they are US-specific and irrelevant outside the United States. Describe climate in plain terms (e.g. "subtropical", "Mediterranean", "temperate"), reference the southern-hemisphere seasons when the location is in the southern hemisphere, and assume the user is not in the US unless the country field says so.
- Express ALL temperatures in your response in ${unit} (e.g. ${unit === '°F' ? '"65–75°F"' : '"18–24°C"'}). Never mix units.`;
};

const WATERING_RECOMMEND_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    amount:                  { type: SchemaType.STRING },
    frequency:               { type: SchemaType.STRING },
    recommendedFrequencyDays: { type: SchemaType.INTEGER },
    method:                  { type: SchemaType.STRING },
    seasonalTips:            { type: SchemaType.STRING },
    signs:                   { type: SchemaType.STRING },
    summary:                 { type: SchemaType.STRING },
  },
  required: ['amount', 'frequency', 'recommendedFrequencyDays', 'method', 'seasonalTips', 'signs', 'summary'],
};

const WATERING_RECOMMEND_PROMPT = (name, species, { plantedIn, isOutdoor, potSize, potMaterial, soilType, sunExposure, health, season, maturity, temperature, location, tempUnit } = {}) => {
  const details = [];
  if (plantedIn) details.push(`planted in: ${plantedIn === 'ground' ? 'the ground' : plantedIn === 'garden-bed' ? 'a garden bed' : 'a pot'}`);
  if (isOutdoor !== undefined) details.push(`growing: ${isOutdoor ? 'outdoors' : 'indoors'}`);
  const loc = formatLocation(location);
  if (loc) details.push(`location: ${loc}`);
  if (potSize) details.push(`pot size: ${potSize}`);
  if (potMaterial) details.push(`pot material: ${potMaterial}`);
  if (soilType) details.push(`soil: ${soilType}`);
  if (sunExposure) details.push(`sun exposure: ${sunExposure}`);
  if (health) details.push(`current health: ${health}`);
  if (maturity) details.push(`maturity: ${maturity}`);
  if (season) details.push(`current season: ${season}`);
  const unit = tempSymbol(tempUnit);
  // The frontend passes the value already in the user's preferred unit
  // (weather is fetched with the selected unit), so we just label it.
  if (temperature !== undefined && temperature !== null && temperature !== '') {
    details.push(`current temperature: ${temperature}${unit}`);
  }
  const ctx = details.length ? `\nPlant details: ${details.join(', ')}.` : '';
  return `You are a plant watering expert. Provide specific watering guidance for: ${name}${species ? ` (${species})` : ''}.${ctx}
Rules:
- amount: specific volume (e.g. "200-300ml" for pots, "deep soak to 15cm" for ground)
- frequency: specific schedule (e.g. "every 5-7 days in summer")
- recommendedFrequencyDays: a single integer (1-30) for the ideal watering interval in days for the CURRENT season and conditions. Consider the species' water needs, container type (terracotta dries faster than plastic), soil drainage, sun exposure, indoor vs outdoor, temperature, and plant maturity
- method: best watering method for this setup
- seasonalTips: how to adjust watering across seasons — use the provided location to choose the correct hemisphere's seasons
- signs: how to tell if over/under-watered
- summary: one sentence overall recommendation
- Tailor all advice to the specific planting situation and local climate. DO NOT reference USDA hardiness zones — they are US-specific. Assume the user is not in the US unless the location's country says so.
- Express ALL temperatures in your response in ${unit}.`;
};

// ── Tier gating + quota enforcement ──────────────────────────────────────────
// Bound once here so handlers can reference requireTier/checkQuota directly.
// Gates no-op when BILLING_ENABLED !== 'true', so this code ships dark.

const { requireTier, checkQuota } = createTierGate(db);

const countPlantsForReq   = (req) => billing.countPlants(db, req.userId);
const countAiAnalysesForReq = (req) => billing.readAiAnalysesUsage(db, req.userId);

// ── Billing — non-webhook routes ─────────────────────────────────────────────
// (Webhook is declared earlier, before express.json(), to keep the raw body
// available for Stripe signature verification.)

const PRICE_ENV = {
  home_pro:       { month: 'STRIPE_PRICE_HOME_PRO_MONTHLY',       year: 'STRIPE_PRICE_HOME_PRO_ANNUAL' },
  landscaper_pro: { month: 'STRIPE_PRICE_LANDSCAPER_PRO_MONTHLY', year: 'STRIPE_PRICE_LANDSCAPER_PRO_ANNUAL' },
};

app.post('/billing/create-checkout-session', requireUser, async (req, res) => {
  const stripe = billing.getStripe();
  if (!stripe) return res.status(503).json({ error: 'billing_disabled' });
  try {
    const { tier, interval = 'month', successUrl, cancelUrl } = req.body || {};
    if (!PRICE_ENV[tier] || !PRICE_ENV[tier][interval]) {
      return res.status(400).json({ error: 'Invalid tier/interval' });
    }
    const priceId = process.env[PRICE_ENV[tier][interval]];
    if (!priceId) return res.status(500).json({ error: `Price ID env var ${PRICE_ENV[tier][interval]} is not configured` });

    // Reuse an existing Stripe Customer if the user already has one.
    const existing = await billing.readSubscription(db, req.userId);
    let customerId = existing?.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { userId: req.userId } });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode:                  'subscription',
      customer:              customerId,
      client_reference_id:   req.userId,
      line_items:            [{ price: priceId, quantity: 1 }],
      success_url:           successUrl || `${process.env.BILLING_SUCCESS_URL || 'https://plants.lopezcloud.dev'}/settings/billing?status=success`,
      cancel_url:            cancelUrl  || `${process.env.BILLING_CANCEL_URL  || 'https://plants.lopezcloud.dev'}/pricing?status=cancelled`,
      subscription_data:     { metadata: { userId: req.userId, tier } },
      metadata:              { userId: req.userId, tier },
    });
    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/billing/create-portal-session', requireUser, async (req, res) => {
  const stripe = billing.getStripe();
  if (!stripe) return res.status(503).json({ error: 'billing_disabled' });
  try {
    const sub = await billing.readSubscription(db, req.userId);
    if (!sub?.stripeCustomerId) return res.status(404).json({ error: 'No active subscription' });
    const portal = await stripe.billingPortal.sessions.create({
      customer:    sub.stripeCustomerId,
      return_url:  req.body?.returnUrl || `${process.env.BILLING_SUCCESS_URL || 'https://plants.lopezcloud.dev'}/settings/billing`,
    });
    return res.status(200).json({ url: portal.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/billing/subscription', requireUser, async (req, res) => {
  try {
    const tier = await billing.getCurrentTier(db, req.userId);
    const sub  = await billing.readSubscription(db, req.userId);
    const [plantsCount, aiAnalyses, storageMb] = await Promise.all([
      billing.countPlants(db, req.userId),
      billing.readAiAnalysesUsage(db, req.userId),
      billing.readStorageUsageMb(db, req.userId),
    ]);
    const trialDaysRemaining = sub?.isTrial && sub?.trialEnd
      ? Math.max(0, Math.ceil((new Date(sub.trialEnd).getTime() - Date.now()) / 86400000))
      : null;
    return res.status(200).json({
      billingEnabled: billing.billingEnabled(),
      tier,
      status:            sub?.status || (billing.billingEnabled() ? 'free' : 'free'),
      currentPeriodEnd:  sub?.currentPeriodEnd || null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
      isTrial:           sub?.isTrial || false,
      trialDaysRemaining,
      quotas: billing.TIERS[tier].quotas,
      usage: {
        plants:           plantsCount,
        ai_analyses:      aiAnalyses,
        photo_storage_mb: storageMb,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

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

// Hemisphere-aware season label for ML rows.  Northern hemisphere maps
// Mar-May → spring etc.; southern hemisphere is shifted six months so an
// April event in Sydney is labelled 'autumn', not 'spring'.  Falls back to
// north when the hemisphere is unknown — preserves prior behaviour for
// users that haven't set a location preference.
function getSeason(dateStr, hemisphere = 'north') {
  const month = new Date(dateStr).getMonth(); // 0-indexed
  const isNorth = hemisphere !== 'south';
  if (isNorth) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }
  if (month >= 2 && month <= 4) return 'autumn';
  if (month >= 5 && month <= 7) return 'winter';
  if (month >= 8 && month <= 10) return 'spring';
  return 'summer';
}

async function getUserHemisphere(userId) {
  try {
    const configDoc = await userConfig(userId).doc('preferences').get();
    if (configDoc.exists && configDoc.data().hemisphere) {
      return configDoc.data().hemisphere;
    }
  } catch { /* fall through to default */ }
  return 'north';
}

function buildFeatureRows(plant, hemisphere = 'north') {
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
      season: getSeason(log[i].date, hemisphere),
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
      const hemisphere = await getUserHemisphere(userDoc.id);
      const plantsSnap = await db.collection('users').doc(userDoc.id).collection('plants').get();
      for (const plantDoc of plantsSnap.docs) {
        allRows.push(...buildFeatureRows(plantDoc.data(), hemisphere));
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

app.post('/analyse', softAuth, checkQuota('ai_analyses', countAiAnalysesForReq), async (req, res) => {
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
    if (req.userId && billing.billingEnabled()) {
      try { await billing.incrementAiAnalyses(db, req.userId); } catch (e) { log.warn('ai-usage increment failed', { error: e.message }); }
    }
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Re-analyse with species hint ─────────────────────────────────────────────

app.post('/analyse-with-hint', softAuth, checkQuota('ai_analyses', countAiAnalysesForReq), async (req, res) => {
  try {
    const { imageBase64, mimeType, speciesHint } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }
    if (!speciesHint) {
      return res.status(400).json({ error: 'speciesHint is required' });
    }

    const hintPrompt = ANALYSE_PROMPT + `\n\nIMPORTANT: The user believes this plant is "${speciesHint}". Use this as the species identification (look up the scientific name) and tailor all care recommendations, watering frequency, soil type, and other advice specifically for this species. If the hint seems plausible from the photo, trust it.`;

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: hintPrompt },
        ],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: ANALYSE_SCHEMA },
    });

    const parsed = parseGeminiJson(result.response.text());
    if (req.userId && billing.billingEnabled()) {
      try { await billing.incrementAiAnalyses(db, req.userId); } catch (e) { log.warn('ai-usage increment failed', { error: e.message }); }
    }
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Plant identification (one-tap) ───────────────────────────────────────────
// Accepts 1–3 photos and returns ranked identification candidates with
// careDefaults pre-populated, ready to seed a new plant document.

const IDENTIFY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    candidates: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          commonName:             { type: SchemaType.STRING },
          scientificName:         { type: SchemaType.STRING },
          confidence:             { type: SchemaType.NUMBER },
          distinguishingFeatures: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          careDefaults: {
            type: SchemaType.OBJECT,
            properties: {
              frequencyDays: { type: SchemaType.INTEGER },
              plantedIn:     { type: SchemaType.STRING },
              soilType:      { type: SchemaType.STRING },
              potSize:       { type: SchemaType.STRING },
              sunExposure:   { type: SchemaType.STRING },
              waterMethod:   { type: SchemaType.STRING },
              waterAmount:   { type: SchemaType.STRING },
            },
            required: ['frequencyDays', 'plantedIn', 'soilType'],
          },
        },
        required: ['commonName', 'scientificName', 'confidence', 'distinguishingFeatures', 'careDefaults'],
      },
    },
  },
  required: ['candidates'],
};

const IDENTIFY_PROMPT = `You are a plant identification expert. Analyse the provided photo(s) and identify the plant species.
Return ONLY valid JSON with up to 5 ranked identification candidates, ordered by confidence (highest first).

Rules:
- commonName: most widely recognised common name in English
- scientificName: genus + species in italics-ready format (e.g. "Monstera deliciosa")
- confidence: 0.0–1.0 probability this identification is correct
- distinguishingFeatures: 2–4 specific visual features that support this identification (leaf shape, pattern, colour, texture)
- careDefaults.frequencyDays: integer 1–30 (watering interval days) based on species needs
- careDefaults.plantedIn: one of "pot" | "garden-bed" | "ground"
- careDefaults.soilType: one of "standard" | "well-draining" | "moisture-retaining" | "succulent-mix" | "orchid-mix"
- careDefaults.potSize: one of "small" | "medium" | "large" | "xlarge" (estimate from photo)
- careDefaults.sunExposure: one of "full-sun" | "part-sun" | "shade"
- careDefaults.waterMethod: one of "jug" | "spray" | "bottom-water" | "hose" | "irrigation" | "drip"
- careDefaults.waterAmount: e.g. "200ml", "500ml", "1L"
- If the plant is unidentifiable, return one candidate with commonName "Unknown plant", scientificName "Unknown", confidence 0.1
- Never return more than 5 candidates
- Respond with JSON only`;

app.post('/plants/identify', softAuth, checkQuota('ai_analyses', countAiAnalysesForReq), async (req, res) => {
  try {
    const { images } = req.body; // [{ imageBase64, mimeType }]
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'images array is required (1–3 items)' });
    }
    if (images.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 images per identification request' });
    }
    for (const img of images) {
      if (!img.imageBase64 || !img.mimeType) {
        return res.status(400).json({ error: 'Each image must have imageBase64 and mimeType' });
      }
    }

    const parts = images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.imageBase64 } }));
    parts.push({ text: IDENTIFY_PROMPT });

    const result = await geminiWithRetry({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: IDENTIFY_SCHEMA,
      },
    });

    const parsed = parseGeminiJson(result.response.text());
    if (req.userId && billing.billingEnabled()) {
      try { await billing.incrementAiAnalyses(db, req.userId); } catch (e) { log.warn('ai-usage increment failed', { error: e.message }); }
    }
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Care recommendations via Gemini ──────────────────────────────────────────

app.post('/recommend', async (req, res) => {
  try {
    const { name, species, plantedIn, isOutdoor, location, tempUnit } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [{ text: RECOMMEND_PROMPT(name, species, { plantedIn, isOutdoor, location, tempUnit }) }],
      }],
      generationConfig: {
        // 1024 tokens is not enough for the 9-field schema; truncated output
        // produces invalid JSON and surfaces as a parse error to the user.
        maxOutputTokens: 3072,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: RECOMMEND_SCHEMA,
      },
    });

    assertNotTruncated(result, '/recommend');
    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/recommend-watering', async (req, res) => {
  try {
    const { name, species, plantedIn, isOutdoor, potSize, potMaterial, soilType, sunExposure, health, season, maturity, temperature, location, tempUnit } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [{ text: WATERING_RECOMMEND_PROMPT(name, species, { plantedIn, isOutdoor, potSize, potMaterial, soilType, sunExposure, health, season, maturity, temperature, location, tempUnit }) }],
      }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: WATERING_RECOMMEND_SCHEMA,
      },
    });

    assertNotTruncated(result, '/recommend-watering');
    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/plants/recalculate-frequencies', requireUser, async (req, res) => {
  try {
    const { season, temperature } = req.body || {};
    const snapshot = await userPlants(req.userId).get();
    const plants = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (plants.length === 0) return res.status(200).json({ updated: 0, results: [] });

    const results = [];
    for (const plant of plants) {
      try {
        const outdoor = OUTDOOR_ROOMS.has(plant.room);
        const result = await geminiWithRetry({
          contents: [{
            role: 'user',
            parts: [{ text: WATERING_RECOMMEND_PROMPT(plant.name, plant.species, {
              plantedIn: plant.plantedIn, isOutdoor: outdoor,
              potSize: plant.potSize, potMaterial: plant.potMaterial,
              soilType: plant.soilType, sunExposure: plant.sunExposure,
              health: plant.health, maturity: plant.maturity,
              season, temperature,
            }) }],
          }],
          generationConfig: {
            maxOutputTokens: 1024, temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema: WATERING_RECOMMEND_SCHEMA,
          },
        });
        const parsed = parseGeminiJson(result.response.text());
        const freq = parsed.recommendedFrequencyDays;
        if (freq && freq >= 1 && freq <= 30) {
          await userPlants(req.userId).doc(plant.id).set(
            { frequencyDays: freq, updatedAt: new Date().toISOString() },
            { merge: true },
          );
          results.push({ id: plant.id, name: plant.name, oldFrequency: plant.frequencyDays, newFrequency: freq });
        }
      } catch (err) {
        log.warn('recalculate frequency failed for plant', { plantId: plant.id, error: err.message });
        results.push({ id: plant.id, name: plant.name, error: err.message });
      }
    }
    res.status(200).json({ updated: results.filter((r) => r.newFrequency).length, results });
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

// ── Branding config ───────────────────────────────────────────────────────────

app.get('/config/branding', requireUser, requireTier('landscaper_pro'), async (req, res) => {
  try {
    const doc = await userConfig(req.userId).doc('branding').get();
    const data = doc.exists ? doc.data() : {};
    if (data.logoUrl) {
      try { data.logoUrl = await signReadUrl(data.logoUrl); } catch { /* serve raw URL on signing failure */ }
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const HEX_COLOUR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

app.put('/config/branding', requireUser, requireTier('landscaper_pro'), async (req, res) => {
  try {
    const { businessName, logoUrl, brandColour, contactPhone, contactEmail, contactWebsite } = req.body || {};
    if (brandColour != null && !HEX_COLOUR_RE.test(brandColour)) {
      return res.status(400).json({ error: 'brandColour must be a valid hex colour (e.g. #3a7d44)' });
    }
    const update = { updatedAt: new Date().toISOString() };
    if (businessName !== undefined) update.businessName = String(businessName).trim().slice(0, 100);
    if (logoUrl !== undefined) update.logoUrl = logoUrl;
    if (brandColour !== undefined) update.brandColour = brandColour;
    if (contactPhone !== undefined) update.contactPhone = String(contactPhone).trim().slice(0, 50);
    if (contactEmail !== undefined) update.contactEmail = String(contactEmail).trim().slice(0, 254);
    if (contactWebsite !== undefined) update.contactWebsite = String(contactWebsite).trim().slice(0, 2048);
    await userConfig(req.userId).doc('branding').set(update, { merge: true });
    if (update.logoUrl) {
      try { update.logoUrl = await signReadUrl(update.logoUrl); } catch { /* serve raw on failure */ }
    }
    res.status(200).json(update);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Households (multi-user shared access) ────────────────────────────────────
// All data still lives at users/{ownerId}/... — households add a membership
// overlay that lets multiple users see and edit the same plants. See
// households.js for the full design.

// GET /households — list households the actor belongs to + which is active
app.get('/households', requireUser, async (req, res) => {
  try {
    const result = await households.listHouseholdsForUser(db, req.actorUserId);
    const items = result.households.map((h) => {
      const memberCount = Object.keys(h.members || {}).length;
      const myRole = h.members?.[req.actorUserId]?.role || null;
      return {
        id: h.id,
        name: h.name,
        ownerId: h.ownerId,
        memberCount,
        role: myRole,
        isActive: h.id === result.activeHouseholdId,
        createdAt: h.createdAt,
      };
    });
    res.status(200).json({ households: items, activeHouseholdId: result.activeHouseholdId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /households/current — full member list for the active household
app.get('/households/current', requireUser, async (req, res) => {
  try {
    const hh = await households.readHousehold(db, req.householdId);
    if (!hh) return res.status(404).json({ error: 'Household not found' });
    const members = Object.entries(hh.members || {}).map(([userId, m]) => ({
      userId,
      role: m.role,
      displayName: m.displayName || null,
      joinedAt: m.joinedAt,
      isYou: userId === req.actorUserId,
      isOwner: userId === hh.ownerId,
    }));
    res.status(200).json({
      id: hh.id,
      name: hh.name,
      ownerId: hh.ownerId,
      role: req.role,
      members,
      createdAt: hh.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /households — create a new household owned by the actor
app.post('/households', requireUser, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 60) || 'My Plants';
    const now = new Date().toISOString();
    const data = {
      name,
      ownerId: req.actorUserId,
      createdAt: now,
      updatedAt: now,
      members: {
        [req.actorUserId]: {
          role: 'owner',
          displayName: req.actorDisplayName || null,
          joinedAt: now,
        },
      },
    };
    const ref = await households.householdsRef(db).add(data);

    const profile = (await households.readProfile(db, req.actorUserId)) || {};
    const ids = Array.from(new Set([...(profile.householdIds || []), ref.id]));
    await households.writeProfile(db, req.actorUserId, {
      activeHouseholdId: ref.id,
      householdIds: ids,
      updatedAt: now,
    });

    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /households/:id — rename (owner only)
app.put('/households/:id', requireUser, async (req, res) => {
  try {
    const hh = await households.readHousehold(db, req.params.id);
    if (!hh) return res.status(404).json({ error: 'Household not found' });
    const member = hh.members?.[req.actorUserId];
    if (!member || !households.roleMeetsMinimum(member.role, 'owner')) {
      return res.status(403).json({ error: 'forbidden_role', requiredRole: 'owner', currentRole: member?.role || null });
    }
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'name is required' });
    await households.householdsRef(db).doc(hh.id).set({ name, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ id: hh.id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /households/:id/switch — set the actor's active household
app.post('/households/:id/switch', requireUser, async (req, res) => {
  try {
    const hh = await households.readHousehold(db, req.params.id);
    if (!hh || !hh.members?.[req.actorUserId]) {
      return res.status(404).json({ error: 'Household not found or not a member' });
    }
    await households.writeProfile(db, req.actorUserId, {
      activeHouseholdId: hh.id,
      updatedAt: new Date().toISOString(),
    });
    res.status(200).json({ id: hh.id, name: hh.name, role: hh.members[req.actorUserId].role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /households/:id/invites — create a share-code invite (owner only)
app.post('/households/:id/invites', requireUser, async (req, res) => {
  try {
    const hh = await households.readHousehold(db, req.params.id);
    if (!hh) return res.status(404).json({ error: 'Household not found' });
    const member = hh.members?.[req.actorUserId];
    if (!member || !households.roleMeetsMinimum(member.role, 'owner')) {
      return res.status(403).json({ error: 'forbidden_role', requiredRole: 'owner', currentRole: member?.role || null });
    }
    const role = req.body?.role || 'editor';
    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ error: 'role must be one of: viewer, editor' });
    }
    const invite = await households.createInvite(db, {
      householdId: hh.id,
      role,
      invitedBy: req.actorUserId,
    });
    res.status(201).json({
      code: invite.code,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /households/join — accept an invite code
app.post('/households/join', requireUser, async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'code is required' });
    let result;
    try {
      result = await households.acceptInvite(db, {
        code,
        actorUserId: req.actorUserId,
        actorDisplayName: req.actorDisplayName,
      });
    } catch (err) {
      if (err.code === 'not_found') return res.status(404).json({ error: 'Invite code not found' });
      if (err.code === 'expired')   return res.status(410).json({ error: 'Invite code expired' });
      if (err.code === 'already_used') return res.status(409).json({ error: 'Invite code already used' });
      if (err.code === 'revoked')   return res.status(410).json({ error: 'Invite code was revoked' });
      throw err;
    }
    res.status(200).json({
      household: { id: result.household.id, name: result.household.name, ownerId: result.household.ownerId },
      role: result.role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /households/:id/members/:userId — remove a member (owner only).
// Owners cannot remove themselves; that requires deleting the household.
app.delete('/households/:id/members/:userId', requireUser, async (req, res) => {
  try {
    const hh = await households.readHousehold(db, req.params.id);
    if (!hh) return res.status(404).json({ error: 'Household not found' });
    const actor = hh.members?.[req.actorUserId];
    if (!actor || !households.roleMeetsMinimum(actor.role, 'owner')) {
      return res.status(403).json({ error: 'forbidden_role', requiredRole: 'owner', currentRole: actor?.role || null });
    }
    const targetId = req.params.userId;
    if (targetId === hh.ownerId) {
      return res.status(400).json({ error: 'Cannot remove the household owner' });
    }
    if (!hh.members[targetId]) return res.status(404).json({ error: 'Member not found' });
    const newMembers = { ...hh.members };
    delete newMembers[targetId];
    await households.householdsRef(db).doc(hh.id).set({
      members: newMembers,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update the removed user's profile so the household no longer appears.
    const profile = (await households.readProfile(db, targetId)) || {};
    const ids = (profile.householdIds || []).filter((id) => id !== hh.id);
    const updates = { householdIds: ids, updatedAt: new Date().toISOString() };
    if (profile.activeHouseholdId === hh.id) updates.activeHouseholdId = null;
    await households.writeProfile(db, targetId, updates);

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /households/:id/members/:userId — change a member's role (owner only)
app.put('/households/:id/members/:userId', requireUser, async (req, res) => {
  try {
    const hh = await households.readHousehold(db, req.params.id);
    if (!hh) return res.status(404).json({ error: 'Household not found' });
    const actor = hh.members?.[req.actorUserId];
    if (!actor || !households.roleMeetsMinimum(actor.role, 'owner')) {
      return res.status(403).json({ error: 'forbidden_role', requiredRole: 'owner', currentRole: actor?.role || null });
    }
    const role = req.body?.role;
    if (!['viewer', 'editor', 'owner'].includes(role)) {
      return res.status(400).json({ error: 'role must be one of: viewer, editor, owner' });
    }
    const targetId = req.params.userId;
    if (targetId === hh.ownerId && role !== 'owner') {
      return res.status(400).json({ error: 'Cannot demote the household owner' });
    }
    if (!hh.members[targetId]) return res.status(404).json({ error: 'Member not found' });
    const newMembers = { ...hh.members, [targetId]: { ...hh.members[targetId], role } };
    await households.householdsRef(db).doc(hh.id).set({
      members: newMembers,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    res.status(200).json({ userId: targetId, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Role gate for writes on /plants and /config ──────────────────────────────
// Runs before the route's own requireUser middleware. Resolves the actor's
// active-household role and rejects writes from viewers (or downgrades
// viewer-attempted DELETEs on whole plants from owner-only to 403).
const WRITE_GATE_SKIP = new Set([
  '/plants/identify', // softAuth, no plant data write
]);

app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  // Only gate writes under the user's data tree — household management routes
  // gate themselves; AI/billing/etc don't need this gate.
  const isPlantPath  = req.path === '/plants' || req.path.startsWith('/plants/');
  const isConfigPath = req.path.startsWith('/config/');
  if (!isPlantPath && !isConfigPath) return next();
  if (WRITE_GATE_SKIP.has(req.path)) return next();

  const claims = getUserClaims(req);
  if (!claims) return next(); // requireUser will 401 downstream

  attachHouseholdContext(req, claims).then(() => {
    const isWholePlantDelete = req.method === 'DELETE' && /^\/plants\/[^/]+$/.test(req.path);
    const min = isWholePlantDelete ? 'owner' : 'editor';
    if (!households.roleMeetsMinimum(req.role, min)) {
      return res.status(403).json({ error: 'forbidden_role', requiredRole: min, currentRole: req.role });
    }
    next();
  }).catch((err) => {
    log.error('write_gate_failed', { error: err.message });
    next();
  });
});

// ── Plants CRUD ───────────────────────────────────────────────────────────────

app.get('/plants', requireUser, async (req, res) => {
  try {
    // Cursor-based pagination: ?limit=N&after=<createdAt ISO cursor>
    // When limit or after params are provided the response is paginated:
    //   { plants: [...], nextCursor: string|null, hasMore: boolean }
    // Without params the legacy flat array is returned for backward compat.
    const rawLimit = req.query.limit !== undefined ? Number(req.query.limit) : null;
    const after    = req.query.after || null;
    const paginated = rawLimit !== null || after !== null;
    const limit = rawLimit ? Math.min(rawLimit, 200) : 200;

    let query = userPlants(req.userId).orderBy('createdAt', 'desc').limit(limit + 1);
    if (after) query = query.startAfter(after);

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
    const nextCursor = hasMore ? docs[docs.length - 1].data().createdAt : null;

    const plants = await Promise.all(
      docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() };
        await signPlantData(data);
        return data;
      })
    );

    if (paginated) {
      res.status(200).json({ plants, nextCursor, hasMore });
    } else {
      res.status(200).json(plants);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── QR short-code helpers ─────────────────────────────────────────────────────

const SHORT_CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateShortCode() {
  let code = 'hp-';
  for (let i = 0; i < 5; i++) {
    code += SHORT_CODE_CHARS[Math.floor(Math.random() * SHORT_CODE_CHARS.length)];
  }
  return code;
}

app.post('/plants', requireUser, checkQuota('plants', countPlantsForReq), async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { imageBase64: _img, ...body } = req.body;
    if (body.imageUrl) {
      try { body.imageUrl = body.imageUrl.split('?')[0]; } catch {}
      body.photoLog = [{ url: body.imageUrl, date: now, type: 'growth', analysis: null }];
    }
    const stamp = households.buildActorStamp(req);
    const data = {
      ...body,
      shortCode: generateShortCode(),
      createdAt: now,
      updatedAt: now,
      createdBy: stamp,
      lastEditedBy: stamp,
    };
    const docRef = await userPlants(req.userId).add(data);
    const response = { id: docRef.id, ...data };
    try { await signPlantData(response); } catch (signErr) {
      log.warn('sign-after-create failed', { plantId: docRef.id, error: signErr.message });
    }
    res.status(201).json(response);
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

    const updates = { ...body, updatedAt: now, lastEditedBy: households.buildActorStamp(req) };

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

    // Add images to photoLog for growth history — only when image actually changed
    if (body.imageUrl) {
      const newImageNorm = body.imageUrl.split('?')[0];
      const existingImageNorm = existing.imageUrl ? existing.imageUrl.split('?')[0] : null;
      if (newImageNorm !== existingImageNorm) {
        const photoLog = [...(existing.photoLog || [])];
        // Push old image if being replaced
        if (existingImageNorm) {
          const alreadyInLog = photoLog.some((e) => e.url?.split('?')[0] === existingImageNorm);
          if (!alreadyInLog) {
            photoLog.push({ url: existingImageNorm, date: existing.updatedAt || new Date().toISOString(), type: 'growth', analysis: null });
          }
        }
        // Push new image
        const newAlreadyInLog = photoLog.some((e) => e.url?.split('?')[0] === newImageNorm);
        if (!newAlreadyInLog) {
          photoLog.push({ url: newImageNorm, date: new Date().toISOString(), type: 'growth', analysis: null });
        }
        updates.photoLog = photoLog;
      }
    }

    await ref.set(updates, { merge: true });

    const updated = await ref.get();
    res.status(200).json({ id: updated.id, ...updated.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── QR short-code resolution & scan ──────────────────────────────────────────

app.get('/plants/:id/short-code', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    let { shortCode } = doc.data();
    if (!shortCode) {
      shortCode = generateShortCode();
      await ref.set({ shortCode }, { merge: true });
    }
    res.status(200).json({ shortCode, plantId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/scan/:shortCode', requireUser, async (req, res) => {
  try {
    const { shortCode } = req.params;
    const plantsRef = userPlants(req.userId);
    const snap = await plantsRef.get();
    const match = snap.docs.find(d => d.data().shortCode === shortCode);
    if (!match) return res.status(404).json({ error: 'QR code not found or belongs to a different account' });
    res.status(200).json({ plantId: match.id, name: match.data().name, species: match.data().species });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const WATERING_METHODS  = ['top', 'bottom', 'mist', 'soak', 'drip', 'irrigation', 'rain'];
const SOIL_BEFORE_OPTS  = ['dry', 'moist', 'wet', 'soggy'];

app.post('/plants/:id/water', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const now = new Date().toISOString();
    const existing = doc.data();
    const {
      amount, method,           // legacy fields — preserved for backward compatibility
      volumeMl, soilBefore, drainedCleanly, fertiliserMixed, note,
    } = req.body || {};

    const wateringMethod = method || null;
    if (wateringMethod && !WATERING_METHODS.includes(wateringMethod)) {
      return res.status(400).json({ error: `method must be one of: ${WATERING_METHODS.join(', ')}` });
    }
    if (soilBefore && !SOIL_BEFORE_OPTS.includes(soilBefore)) {
      return res.status(400).json({ error: `soilBefore must be one of: ${SOIL_BEFORE_OPTS.join(', ')}` });
    }

    const stamp = households.buildActorStamp(req);
    const entry = {
      date: now,
      note: note || '',
      // Legacy field kept for ML pipelines that still read wateringLog[].amount
      amount: amount || (volumeMl != null ? String(volumeMl) + 'ml' : null),
      method: wateringMethod,
      volumeMl: volumeMl != null ? Number(volumeMl) : null,
      soilBefore: soilBefore || null,
      drainedCleanly: drainedCleanly != null ? Boolean(drainedCleanly) : null,
      fertiliserMixed: fertiliserMixed || null,
      wateredBy: stamp,
    };

    const wateringLog = [...(existing.wateringLog || []), entry];

    // Invalidate ML caches on new watering event
    const mlCache = { ...(existing.mlCache || {}) };
    delete mlCache.wateringPattern;
    delete mlCache.wateringRecommendation;
    delete mlCache.healthPrediction;
    await ref.set({
      lastWatered: now,
      wateringLog,
      updatedAt: now,
      mlCache,
      lastWateredBy: stamp,
      lastEditedBy: stamp,
    }, { merge: true });

    const updated = await ref.get();
    const data = { id: updated.id, ...updated.data() };
    await signPlantData(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Watering history ─────────────────────────────────────────────────────────

app.get('/plants/:id/waterings', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const limit  = Math.min(Number(req.query.limit) || 50, 200);
    const waterings = [...(plant.wateringLog || [])]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

    res.status(200).json({ waterings, total: (plant.wateringLog || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Moisture meter reading ──────────────────────────────────────────────────

app.post('/plants/:id/moisture', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { reading, note } = req.body || {};
    const parsed = Number(reading);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return res.status(400).json({ error: 'reading must be an integer between 1 and 10' });
    }

    const now = new Date().toISOString();
    const existing = doc.data();
    const moistureLog = [...(existing.moistureLog || []), { date: now, reading: parsed, note: note || '' }];

    // Invalidate ML caches that depend on moisture data
    const mlCache = { ...(existing.mlCache || {}) };
    delete mlCache.wateringRecommendation;
    delete mlCache.healthPrediction;

    await ref.set({
      moistureLog,
      lastMoistureReading: parsed,
      lastMoistureDate: now,
      updatedAt: now,
      mlCache,
    }, { merge: true });

    const updated = await ref.get();
    const data = { id: updated.id, ...updated.data() };
    await signPlantData(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fertiliser log ───────────────────────────────────────────────────────────

app.post('/plants/:id/fertilise', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { productName, npk, dilution, amount, notes } = req.body || {};
    const now = new Date().toISOString();
    const existing = doc.data();

    const entry = {
      date: now,
      productName: productName || null,
      npk: npk || null,
      dilution: dilution || null,
      amount: amount || null,
      notes: notes || '',
    };
    const fertiliserLog = [...(existing.fertiliserLog || []), entry];

    // Remember the product/dilution for quick-repeat next time so the user
    // doesn't have to retype. Only update the fertiliser block if meaningful
    // fields were supplied.
    const fertiliser = { ...(existing.fertiliser || {}) };
    if (productName) fertiliser.productName = productName;
    if (npk) fertiliser.npk = npk;
    if (dilution) fertiliser.dilution = dilution;

    await ref.set({
      lastFertilised: now,
      fertiliserLog,
      fertiliser,
      updatedAt: now,
    }, { merge: true });

    const updated = await ref.get();
    const data = { id: updated.id, ...updated.data() };
    await signPlantData(data);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Growth measurements ───────────────────────────────────────────────────────

app.get('/plants/:id/measurements', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    res.status(200).json(doc.data().measurements || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/measurements', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { height_cm, width_cm, leafCount, stemCount, notes } = req.body || {};
    const payload = {};
    if (height_cm != null && height_cm !== '') payload.height_cm = Number(height_cm);
    if (width_cm  != null && width_cm  !== '') payload.width_cm  = Number(width_cm);
    if (leafCount  != null && leafCount  !== '') payload.leafCount  = Number(leafCount);
    if (stemCount  != null && stemCount  !== '') payload.stemCount  = Number(stemCount);
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'At least one of height_cm, width_cm, leafCount, or stemCount is required' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const entry = { id, date: now, notes: notes || '', ...payload };
    const existing = doc.data();
    const measurements = [...(existing.measurements || []), entry];
    await ref.set({ measurements, updatedAt: now }, { merge: true });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id/measurements/:measurementId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const existing = doc.data();
    const measurements = (existing.measurements || []).filter(m => m.id !== req.params.measurementId);
    await ref.set({ measurements, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Phenology events ──────────────────────────────────────────────────────────

const PHENOLOGY_EVENTS = new Set(['first-leaf', 'first-bud', 'first-bloom', 'first-fruit', 'leaf-drop', 'dormancy', 'new-growth', 'other']);

app.get('/plants/:id/phenology', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    res.status(200).json(doc.data().phenologyEvents || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/phenology', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { event, notes, date } = req.body || {};
    if (!event || !PHENOLOGY_EVENTS.has(event)) {
      return res.status(400).json({ error: `event must be one of: ${[...PHENOLOGY_EVENTS].join(', ')}` });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const entry = { id, date: date || now, event, notes: notes || '' };
    const existing = doc.data();
    const phenologyEvents = [...(existing.phenologyEvents || []), entry];
    await ref.set({ phenologyEvents, updatedAt: now }, { merge: true });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id/phenology/:eventId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const existing = doc.data();
    const phenologyEvents = (existing.phenologyEvents || []).filter(e => e.id !== req.params.eventId);
    await ref.set({ phenologyEvents, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plant journal ─────────────────────────────────────────────────────────────

const JOURNAL_MOOD_VALUES = new Set(['thriving', 'ok', 'struggling', 'dying']);
const JOURNAL_TAG_VALUES  = new Set(['pest', 'disease', 'bloom', 'new-growth', 'repot', 'propagate', 'relocate', 'experiment', 'other']);

app.get('/plants/:id/journal', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const entries = (doc.data().journalEntries || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/journal', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { body, tags, mood, date } = req.body || {};
    if (!body || !String(body).trim()) {
      return res.status(400).json({ error: 'body is required' });
    }
    const invalidTags = (tags || []).filter(t => !JOURNAL_TAG_VALUES.has(t));
    if (invalidTags.length) {
      return res.status(400).json({ error: `Invalid tags: ${invalidTags.join(', ')}` });
    }
    if (mood && !JOURNAL_MOOD_VALUES.has(mood)) {
      return res.status(400).json({ error: `mood must be one of: ${[...JOURNAL_MOOD_VALUES].join(', ')}` });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const entry = {
      id,
      date: date || now,
      body: String(body).trim(),
      tags: tags || [],
      mood: mood || null,
      createdAt: now,
    };
    const existing = doc.data();
    const journalEntries = [...(existing.journalEntries || []), entry];
    await ref.set({ journalEntries, updatedAt: now }, { merge: true });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/plants/:id/journal/:entryId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { body, tags, mood } = req.body || {};
    if (body !== undefined && !String(body).trim()) {
      return res.status(400).json({ error: 'body cannot be empty' });
    }
    const invalidTags = (tags || []).filter(t => !JOURNAL_TAG_VALUES.has(t));
    if (invalidTags.length) return res.status(400).json({ error: `Invalid tags: ${invalidTags.join(', ')}` });
    if (mood && !JOURNAL_MOOD_VALUES.has(mood)) {
      return res.status(400).json({ error: `mood must be one of: ${[...JOURNAL_MOOD_VALUES].join(', ')}` });
    }

    const existing = doc.data();
    const journalEntries = (existing.journalEntries || []).map(e => {
      if (e.id !== req.params.entryId) return e;
      return {
        ...e,
        ...(body !== undefined ? { body: String(body).trim() } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(mood !== undefined ? { mood } : {}),
        updatedAt: new Date().toISOString(),
      };
    });
    const now = new Date().toISOString();
    await ref.set({ journalEntries, updatedAt: now }, { merge: true });
    const updated = journalEntries.find(e => e.id === req.params.entryId);
    if (!updated) return res.status(404).json({ error: 'Journal entry not found' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id/journal/:entryId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const existing = doc.data();
    const journalEntries = (existing.journalEntries || []).filter(e => e.id !== req.params.entryId);
    await ref.set({ journalEntries, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Harvest log (edible plants) ───────────────────────────────────────────────

const HARVEST_UNITS = new Set(['g', 'kg', 'oz', 'lb', 'count', 'bunches']);

app.get('/plants/:id/harvests', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const entries = (doc.data().harvestLog || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    res.status(200).json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/harvests', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { date, quantity, unit, quality, notes } = req.body || {};
    if (quantity == null || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }
    if (!unit || !HARVEST_UNITS.has(unit)) {
      return res.status(400).json({ error: `unit must be one of: ${[...HARVEST_UNITS].join(', ')}` });
    }
    if (quality != null && (Number(quality) < 1 || Number(quality) > 5)) {
      return res.status(400).json({ error: 'quality must be between 1 and 5' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const entry = {
      id,
      date: date || now,
      quantity: Number(quantity),
      unit,
      quality: quality != null ? Number(quality) : null,
      notes: notes ? String(notes).trim() : null,
      createdAt: now,
    };
    const existing = doc.data();
    const harvestLog = [...(existing.harvestLog || []), entry];
    await ref.set({ harvestLog, updatedAt: now }, { merge: true });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id/harvests/:harvestId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const existing = doc.data();
    const harvestLog = (existing.harvestLog || []).filter(e => e.id !== req.params.harvestId);
    await ref.set({ harvestLog, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Wildlife / pollinator observation log ────────────────────────────────────

const WILDLIFE_CATEGORIES = new Set(['bee', 'butterfly', 'bird', 'other-insect', 'mammal', 'reptile', 'other']);

app.get('/plants/:id/wildlifeObservations', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const entries = (doc.data().wildlifeObservationLog || []).sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt));
    res.status(200).json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/wildlifeObservations', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { observedAt, category, species, count, notes } = req.body || {};
    if (!category || !WILDLIFE_CATEGORIES.has(category)) {
      return res.status(400).json({ error: `category must be one of: ${[...WILDLIFE_CATEGORIES].join(', ')}` });
    }
    if (count != null && (isNaN(Number(count)) || Number(count) < 1)) {
      return res.status(400).json({ error: 'count must be a positive integer' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const entry = {
      id,
      observedAt: observedAt || now,
      category,
      species: species ? String(species).trim() : null,
      count: count != null ? Math.round(Number(count)) : null,
      notes: notes ? String(notes).trim() : null,
      createdAt: now,
    };
    const existing = doc.data();
    const wildlifeObservationLog = [...(existing.wildlifeObservationLog || []), entry];
    await ref.set({ wildlifeObservationLog, updatedAt: now }, { merge: true });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id/wildlifeObservations/:obsId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const existing = doc.data();
    const wildlifeObservationLog = (existing.wildlifeObservationLog || []).filter(e => e.id !== req.params.obsId);
    await ref.set({ wildlifeObservationLog, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Incident log (pest, disease, deficiency, environmental) ──────────────────

const INCIDENT_CATEGORIES = new Set(['pest', 'disease', 'deficiency', 'environmental']);
const OUTBREAK_WINDOW_DAYS = 14;

app.get('/plants/:id/incidents', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const entries = (doc.data().incidents || []).sort((a, b) => new Date(b.firstObservedAt) - new Date(a.firstObservedAt));
    res.status(200).json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/incidents', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { category, specificType, severity, firstObservedAt, notes } = req.body || {};
    if (!category || !INCIDENT_CATEGORIES.has(category)) {
      return res.status(400).json({ error: `category must be one of: ${[...INCIDENT_CATEGORIES].join(', ')}` });
    }
    if (!specificType || !String(specificType).trim()) {
      return res.status(400).json({ error: 'specificType is required' });
    }
    if (severity != null && (Number(severity) < 1 || Number(severity) > 5)) {
      return res.status(400).json({ error: 'severity must be between 1 and 5' });
    }

    const now = new Date().toISOString();
    const observedAt = firstObservedAt || now;
    const plantData = doc.data();

    // Auto-group outbreak: scan other plants in same room for same category+specificType within 14 days
    const windowStart = new Date(observedAt);
    windowStart.setDate(windowStart.getDate() - OUTBREAK_WINDOW_DAYS);
    let outbreakId = null;

    if (plantData.room) {
      const plantsSnap = await userPlants(req.userId).get();
      for (const plantDoc of plantsSnap.docs) {
        if (plantDoc.id === req.params.id) continue;
        const other = plantDoc.data();
        if (other.room !== plantData.room) continue;
        const linked = (other.incidents || []).find(i =>
          !i.resolvedAt &&
          i.category === category &&
          i.specificType === specificType &&
          new Date(i.firstObservedAt) >= windowStart,
        );
        if (linked) {
          outbreakId = outbreakId || linked.outbreakId || crypto.randomUUID();
          if (!linked.outbreakId) {
            const updatedIncidents = (other.incidents || []).map(i =>
              i.id === linked.id ? { ...i, outbreakId } : i,
            );
            await userPlants(req.userId).doc(plantDoc.id).set(
              { incidents: updatedIncidents, updatedAt: now }, { merge: true },
            );
          }
        }
      }
    }

    const entry = {
      id: crypto.randomUUID(),
      category,
      specificType: String(specificType).trim(),
      severity: severity != null ? Number(severity) : null,
      firstObservedAt: observedAt,
      resolvedAt: null,
      treatments: [],
      notes: notes ? String(notes).trim() : null,
      outbreakId: outbreakId || null,
      createdAt: now,
      updatedAt: now,
    };
    const incidents = [...(plantData.incidents || []), entry];
    await ref.set({ incidents, updatedAt: now }, { merge: true });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/plants/:id/incidents/:incidentId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { category, specificType, severity, notes } = req.body || {};
    if (category !== undefined && !INCIDENT_CATEGORIES.has(category)) {
      return res.status(400).json({ error: `category must be one of: ${[...INCIDENT_CATEGORIES].join(', ')}` });
    }
    if (severity != null && (Number(severity) < 1 || Number(severity) > 5)) {
      return res.status(400).json({ error: 'severity must be between 1 and 5' });
    }

    const now = new Date().toISOString();
    const existing = doc.data();
    const incidents = (existing.incidents || []).map(e => {
      if (e.id !== req.params.incidentId) return e;
      return {
        ...e,
        ...(category !== undefined ? { category } : {}),
        ...(specificType !== undefined ? { specificType: String(specificType).trim() } : {}),
        ...(severity !== undefined ? { severity: severity != null ? Number(severity) : null } : {}),
        ...(notes !== undefined ? { notes: notes ? String(notes).trim() : null } : {}),
        updatedAt: now,
      };
    });
    await ref.set({ incidents, updatedAt: now }, { merge: true });
    const updated = incidents.find(e => e.id === req.params.incidentId);
    if (!updated) return res.status(404).json({ error: 'Incident not found' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/incidents/:incidentId/treatments', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { treatment, appliedAt, outcome } = req.body || {};
    if (!treatment || !String(treatment).trim()) {
      return res.status(400).json({ error: 'treatment is required' });
    }

    const now = new Date().toISOString();
    const treatmentEntry = {
      id: crypto.randomUUID(),
      treatment: String(treatment).trim(),
      appliedAt: appliedAt || now,
      outcome: outcome ? String(outcome).trim() : null,
      createdAt: now,
    };
    const existing = doc.data();
    let found = false;
    const incidents = (existing.incidents || []).map(e => {
      if (e.id !== req.params.incidentId) return e;
      found = true;
      return { ...e, treatments: [...(e.treatments || []), treatmentEntry], updatedAt: now };
    });
    if (!found) return res.status(404).json({ error: 'Incident not found' });
    await ref.set({ incidents, updatedAt: now }, { merge: true });
    res.status(201).json(treatmentEntry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/incidents/:incidentId/resolve', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const now = new Date().toISOString();
    const existing = doc.data();
    let found = false;
    const incidents = (existing.incidents || []).map(e => {
      if (e.id !== req.params.incidentId) return e;
      found = true;
      return { ...e, resolvedAt: req.body?.resolvedAt || now, updatedAt: now };
    });
    if (!found) return res.status(404).json({ error: 'Incident not found' });
    await ref.set({ incidents, updatedAt: now }, { merge: true });
    res.status(200).json(incidents.find(e => e.id === req.params.incidentId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id/incidents/:incidentId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const existing = doc.data();
    const incidents = (existing.incidents || []).filter(e => e.id !== req.params.incidentId);
    await ref.set({ incidents, updatedAt: new Date().toISOString() }, { merge: true });
    res.status(200).json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/outbreaks', requireUser, async (req, res) => {
  try {
    const plantsSnap = await userPlants(req.userId).get();
    const outbreakMap = {};

    for (const plantDoc of plantsSnap.docs) {
      const plant = plantDoc.data();
      for (const incident of (plant.incidents || [])) {
        if (incident.resolvedAt) continue;
        if (!incident.outbreakId) continue;
        if (!outbreakMap[incident.outbreakId]) {
          outbreakMap[incident.outbreakId] = {
            outbreakId: incident.outbreakId,
            category: incident.category,
            specificType: incident.specificType,
            plants: [],
            firstObservedAt: incident.firstObservedAt,
            maxSeverity: incident.severity || 0,
          };
        }
        const ob = outbreakMap[incident.outbreakId];
        ob.plants.push({ plantId: plantDoc.id, plantName: plant.name, room: plant.room, incidentId: incident.id, severity: incident.severity });
        if ((incident.severity || 0) > ob.maxSeverity) ob.maxSeverity = incident.severity || 0;
        if (new Date(incident.firstObservedAt) < new Date(ob.firstObservedAt)) ob.firstObservedAt = incident.firstObservedAt;
      }
    }

    const outbreaks = Object.values(outbreakMap)
      .filter(ob => ob.plants.length > 0)
      .sort((a, b) => (b.maxSeverity * b.plants.length) - (a.maxSeverity * a.plants.length));

    res.status(200).json(outbreaks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/outbreaks/:outbreakId/treat', requireUser, async (req, res) => {
  try {
    const { treatment, appliedAt, outcome } = req.body || {};
    if (!treatment || !String(treatment).trim()) {
      return res.status(400).json({ error: 'treatment is required' });
    }
    const now = new Date().toISOString();
    const treatmentEntry = {
      id: crypto.randomUUID(),
      treatment: String(treatment).trim(),
      appliedAt: appliedAt || now,
      outcome: outcome ? String(outcome).trim() : null,
      createdAt: now,
    };

    const plantsSnap = await userPlants(req.userId).get();
    let updatedCount = 0;
    for (const plantDoc of plantsSnap.docs) {
      const plant = plantDoc.data();
      const hasMatch = (plant.incidents || []).some(i => i.outbreakId === req.params.outbreakId && !i.resolvedAt);
      if (!hasMatch) continue;
      const incidents = (plant.incidents || []).map(i => {
        if (i.outbreakId !== req.params.outbreakId || i.resolvedAt) return i;
        return { ...i, treatments: [...(i.treatments || []), treatmentEntry], updatedAt: now };
      });
      await userPlants(req.userId).doc(plantDoc.id).set({ incidents, updatedAt: now }, { merge: true });
      updatedCount++;
    }
    res.status(200).json({ applied: updatedCount, treatment: treatmentEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/outbreaks/:outbreakId/resolve', requireUser, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const resolvedAt = req.body?.resolvedAt || now;
    const plantsSnap = await userPlants(req.userId).get();
    let updatedCount = 0;
    for (const plantDoc of plantsSnap.docs) {
      const plant = plantDoc.data();
      const hasMatch = (plant.incidents || []).some(i => i.outbreakId === req.params.outbreakId && !i.resolvedAt);
      if (!hasMatch) continue;
      const incidents = (plant.incidents || []).map(i => {
        if (i.outbreakId !== req.params.outbreakId || i.resolvedAt) return i;
        return { ...i, resolvedAt, updatedAt: now };
      });
      await userPlants(req.userId).doc(plantDoc.id).set({ incidents, updatedAt: now }, { merge: true });
      updatedCount++;
    }
    res.status(200).json({ resolved: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fertiliser recommendation (Gemini, structured) ───────────────────────────

const FERTILISER_RECOMMEND_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    productName:    { type: SchemaType.STRING },
    npk:            { type: SchemaType.STRING },
    dilution:       { type: SchemaType.STRING },
    amount:         { type: SchemaType.STRING },
    frequencyDays:  { type: SchemaType.INTEGER },
    season:         { type: SchemaType.STRING },
    signs:          { type: SchemaType.STRING },
    summary:        { type: SchemaType.STRING },
  },
  required: ['productName', 'npk', 'dilution', 'amount', 'frequencyDays', 'season', 'signs', 'summary'],
};

const FERTILISER_RECOMMEND_PROMPT = (name, species, { plantedIn, isOutdoor, potSize, soilType, health, season, maturity, location, tempUnit } = {}) => {
  const details = [];
  if (plantedIn) details.push(`planted in: ${plantedIn === 'ground' ? 'the ground' : plantedIn === 'garden-bed' ? 'a garden bed' : 'a pot'}`);
  if (isOutdoor !== undefined) details.push(`growing: ${isOutdoor ? 'outdoors' : 'indoors'}`);
  const loc = formatLocation(location);
  if (loc) details.push(`location: ${loc}`);
  if (potSize) details.push(`pot size: ${potSize}`);
  if (soilType) details.push(`soil: ${soilType}`);
  if (health) details.push(`current health: ${health}`);
  if (maturity) details.push(`maturity: ${maturity}`);
  if (season) details.push(`current season: ${season}`);
  const unit = tempSymbol(tempUnit);
  const ctx = details.length ? `\nPlant details: ${details.join(', ')}.` : '';
  return `You are a plant fertilising expert. Provide a specific, safe feeding regimen for: ${name}${species ? ` (${species})` : ''}.${ctx}
Rules:
- productName: a concrete product category (e.g. "Balanced liquid houseplant food", "Tomato & vegetable feed", "Seaweed extract")
- npk: NPK ratio most appropriate (e.g. "10-10-10", "3-1-2", "5-10-10")
- dilution: exact mixing ratio (e.g. "5ml per 1L water", "1 tsp per 4L")
- amount: how much solution to apply (e.g. "250-500ml per pot", "light soaking of root zone")
- frequencyDays: integer interval in days between feedings for the CURRENT season
- season: which seasons to feed in — be explicit for the user's hemisphere from the location context, and call out dormancy. Do not use USDA hardiness zones.
- signs: two short sentences — signs of under-feeding AND signs of over-feeding (leaf burn, salt crust)
- summary: one sentence overall recommendation
- Express all temperatures in ${unit}. Favour dilute, frequent feeds over concentrated doses — over-feeding harms plants faster than under-feeding.`;
};

app.post('/recommend-fertiliser', async (req, res) => {
  try {
    const { name, species, plantedIn, isOutdoor, potSize, soilType, health, season, maturity, location, tempUnit } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await geminiWithRetry({
      contents: [{
        role: 'user',
        parts: [{ text: FERTILISER_RECOMMEND_PROMPT(name, species, { plantedIn, isOutdoor, potSize, soilType, health, season, maturity, location, tempUnit }) }],
      }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
        responseMimeType: 'application/json',
        responseSchema: FERTILISER_RECOMMEND_SCHEMA,
      },
    });

    assertNotTruncated(result, '/recommend-fertiliser');
    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Plant diagnostic photo analysis ──────────────────────────────────────────

const DIAGNOSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    diagnoses: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:       { type: SchemaType.STRING },
          confidence: { type: SchemaType.NUMBER },
          category:   { type: SchemaType.STRING },
          evidence:   { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          severity:   { type: SchemaType.STRING },
        },
        required: ['name', 'confidence', 'category', 'evidence', 'severity'],
      },
    },
    treatments: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          step:            { type: SchemaType.INTEGER },
          action:          { type: SchemaType.STRING },
          urgency:         { type: SchemaType.STRING },
          safeForEdibles:  { type: SchemaType.BOOLEAN },
          productExamples: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ['step', 'action', 'urgency', 'safeForEdibles'],
      },
    },
    preventiveCare: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    escalation: {
      type: SchemaType.OBJECT,
      properties: {
        consultExpert: { type: SchemaType.BOOLEAN },
        urgentFlags:   { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      },
      required: ['consultExpert', 'urgentFlags'],
    },
  },
  required: ['diagnoses', 'treatments', 'preventiveCare', 'escalation'],
};

function buildDiagnosticPrompt({ symptoms = [], contextTags = [], isEdible = false } = {}) {
  const edibleRule = isEdible
    ? '- This plant is EDIBLE. Every treatment MUST be food-safe and organic. Set safeForEdibles=true only for treatments that are safe to use on edible plants. Prefer neem oil, insecticidal soap, copper fungicide, diatomaceous earth, or physical removal over synthetic pesticides.'
    : '';
  const symptomCtx = symptoms.length ? `Reported symptoms: ${symptoms.join(', ')}.` : '';
  const tagCtx = contextTags.length ? `Context: ${contextTags.join(', ')}.` : '';

  return `Analyse this plant photo for pests, diseases, nutrient deficiencies, or environmental stress.
${symptomCtx}
${tagCtx}

Return valid JSON matching this schema:
{
  "diagnoses": [
    { "name": "Spider mites", "confidence": 0.82, "category": "pest", "evidence": ["stippled leaves", "fine webbing"], "severity": "moderate" }
  ],
  "treatments": [
    { "step": 1, "action": "Rinse foliage with water", "urgency": "today", "safeForEdibles": true, "productExamples": [] }
  ],
  "preventiveCare": ["Increase humidity to 50%+"],
  "escalation": { "consultExpert": false, "urgentFlags": [] }
}
Rules:
- diagnoses: rank by confidence descending; confidence is 0.0–1.0; category must be one of: pest, disease, deficiency, environmental
- severity must be one of: mild, moderate, severe
- treatments: numbered steps in recommended order; urgency must be one of: today, this-week, ongoing
- escalation.consultExpert: true when top confidence < 0.5 or severity is severe and cause is unclear
${edibleRule}
- Respond with JSON only, no markdown or extra text`;
}

app.post('/plants/:id/diagnostic', requireUser, checkQuota('ai_analyses', countAiAnalysesForReq), async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { imageBase64, mimeType, symptoms, contextTags } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    const plantData = doc.data();
    const isEdible = (contextTags || []).includes('edible') || (plantData.category === 'edible');

    // Upload diagnostic image to GCS
    const ext = mimeType.split('/')[1] || 'jpg';
    const filename = `diagnostics/${crypto.randomUUID()}.${ext}`;
    const file = storage.bucket(IMAGES_BUCKET).file(filename);
    const buffer = Buffer.from(imageBase64, 'base64');
    await file.save(buffer, { contentType: mimeType, resumable: false });
    const publicUrl = `https://storage.googleapis.com/${IMAGES_BUCKET}/${filename}`;

    // Analyse with Gemini using structured schema
    let analysis = null;
    try {
      const prompt = buildDiagnosticPrompt({ symptoms, contextTags, isEdible });
      const result = await geminiWithRetry({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: DIAGNOSE_SCHEMA,
          maxOutputTokens: 2048,
        },
      });
      analysis = parseGeminiJson(result.response.text());
    } catch (err) {
      log.warn('Diagnostic analysis failed', { error: err.message });
    }

    // Persist diagnosis to dedicated subcollection for tracking
    const diagnosisId = crypto.randomUUID();
    const diagnosisRef = userPlants(req.userId).doc(req.params.id)
      .collection('diagnoses').doc(diagnosisId);
    const diagnosisEntry = {
      id: diagnosisId,
      imageUrl: publicUrl,
      analysis,
      symptoms: symptoms || [],
      contextTags: contextTags || [],
      createdAt: new Date().toISOString(),
    };
    await diagnosisRef.set(diagnosisEntry);

    // Also append to photoLog for timeline display
    const photoLog = [...(plantData.photoLog || [])];
    const photoEntry = { url: publicUrl, date: new Date().toISOString(), type: 'diagnostic', analysis, diagnosisId };
    photoLog.push(photoEntry);
    await ref.set({ photoLog, updatedAt: new Date().toISOString() }, { merge: true });

    try { await billing.incrementAiAnalyses(db, req.userId); } catch (e) { log.warn('ai-usage increment failed', { error: e.message }); }

    res.status(200).json({ ...photoEntry, diagnosisId });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Delete a photo from photoLog ─────────────────────────────────────────────

app.delete('/plants/:id/photos', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const existing = doc.data();
    const photoLog = [...(existing.photoLog || [])];
    const normalised = url.split('?')[0];
    const idx = photoLog.findIndex((e) => e.url?.split('?')[0] === normalised);
    if (idx === -1) return res.status(404).json({ error: 'Photo not found in log' });

    photoLog.splice(idx, 1);

    // Delete the file from GCS (best-effort)
    const path = gcsPath(normalised);
    if (path) await storage.bucket(IMAGES_BUCKET).file(path).delete().catch(() => {});

    // If the deleted photo was the current plant image, fall back to latest remaining photo
    const updates = { photoLog, updatedAt: new Date().toISOString() };
    const existingImageNorm = existing.imageUrl ? existing.imageUrl.split('?')[0] : null;
    if (existingImageNorm === normalised) {
      const latest = [...photoLog].filter((e) => e.type === 'growth').sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      updates.imageUrl = latest?.url || null;
    }

    await ref.set(updates, { merge: true });

    const updated = await ref.get();
    const data = { id: updated.id, ...updated.data() };
    await signPlantData(data);
    res.status(200).json(data);
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

app.get('/plants/:id/watering-pattern', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    if (billing.billingEnabled()) {
      const currentTier = await billing.getCurrentTier(db, req.userId).catch(() => 'free');
      if (!billing.tierMeetsMinimum(currentTier, 'home_pro')) {
        return res.status(200).json({ upgrade_required: true, tier: currentTier });
      }
    }
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
        const hemisphere = await getUserHemisphere(req.userId);
        const featureRows = buildFeatureRows(plant, hemisphere);
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

app.get('/plants/:id/watering-recommendation', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    if (billing.billingEnabled()) {
      const currentTier = await billing.getCurrentTier(db, req.userId).catch(() => 'free');
      if (!billing.tierMeetsMinimum(currentTier, 'home_pro')) {
        return res.status(200).json({ upgrade_required: true, tier: currentTier });
      }
    }
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
        const hemisphere = await getUserHemisphere(req.userId);
        const featureRows = buildFeatureRows(plant, hemisphere);
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

app.get('/plants/:id/health-prediction', requireUser, requireTier('home_pro'), async (req, res) => {
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
        const hemisphere = await getUserHemisphere(req.userId);
        const featureRows = buildFeatureRows(plant, hemisphere);
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

const getSeasonForHemisphere = (date, hemisphere) => getSeason(date, hemisphere);

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

app.get('/plants/:id/seasonal-adjustment', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    if (billing.billingEnabled()) {
      const currentTier = await billing.getCurrentTier(db, req.userId).catch(() => 'free');
      if (!billing.tierMeetsMinimum(currentTier, 'home_pro')) {
        return res.status(200).json({ upgrade_required: true, tier: currentTier });
      }
    }
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const plant = doc.data();
    const hemisphere = await getUserHemisphere(req.userId);

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
        const hemisphere = await getUserHemisphere(req.userId);
        const featureRows = buildFeatureRows(plant, hemisphere);
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
app.get('/ml/care-scores', requireUser, requireTier('home_pro'), async (req, res) => {
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
app.get('/plants/:id/anomaly', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    if (billing.billingEnabled()) {
      const currentTier = await billing.getCurrentTier(db, req.userId).catch(() => 'free');
      if (!billing.tierMeetsMinimum(currentTier, 'home_pro')) {
        return res.status(200).json({ upgrade_required: true, tier: currentTier });
      }
    }
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

// GET /plants/:id/lineage — ancestry and descendants (depth ≤ 3)
app.get('/plants/:id/lineage', requireUser, async (req, res) => {
  try {
    const depth = Math.min(parseInt(req.query.depth) || 3, 3);
    const targetId = req.params.id;

    const snap = await userPlants(req.userId).get();
    const allPlants = {};
    for (const doc of snap.docs) {
      allPlants[doc.id] = { id: doc.id, ...doc.data() };
    }

    if (!allPlants[targetId]) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Walk up parentPlantId chain for ancestors
    const ancestors = [];
    const visited = new Set([targetId]);
    let cursor = allPlants[targetId];
    for (let d = 0; d < depth; d++) {
      if (!cursor.parentPlantId || !allPlants[cursor.parentPlantId]) break;
      if (visited.has(cursor.parentPlantId)) break; // cycle guard
      visited.add(cursor.parentPlantId);
      cursor = allPlants[cursor.parentPlantId];
      ancestors.unshift({ id: cursor.id, name: cursor.name, species: cursor.species, health: cursor.health });
    }

    // Collect direct children recursively (BFS, depth-limited)
    function getChildren(plantId, currentDepth) {
      if (currentDepth >= depth) return [];
      return Object.values(allPlants)
        .filter(p => p.parentPlantId === plantId)
        .map(p => ({
          id: p.id, name: p.name, species: p.species, health: p.health,
          propagationMethod: p.propagationMethod || null,
          children: getChildren(p.id, currentDepth + 1),
        }));
    }

    const plant = allPlants[targetId];
    res.status(200).json({
      plant: { id: plant.id, name: plant.name, species: plant.species, health: plant.health, parentPlantId: plant.parentPlantId || null },
      ancestors,
      children: getChildren(targetId, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Soil health log (#304) ────────────────────────────────────────────────────

function userSoilTests(userId, plantId) {
  return userPlants(userId).doc(plantId).collection('soilTests');
}
function userAmendments(userId, plantId) {
  return userPlants(userId).doc(plantId).collection('amendments');
}
function userSubstrateChanges(userId, plantId) {
  return userPlants(userId).doc(plantId).collection('substrateChanges');
}

const SOIL_SOURCES = new Set(['strip', 'probe', 'lab', 'visual']);
const AMENDMENT_KINDS = new Set(['compost', 'lime', 'sulphur', 'gypsum', 'biochar', 'fertiliser', 'other']);
const TEXTURE_OPTIONS = new Set(['sand', 'silt', 'clay', 'loam', 'mix']);

// GET /plants/:id/soil-tests
app.get('/plants/:id/soil-tests', requireUser, async (req, res) => {
  try {
    const plant = await userPlants(req.userId).doc(req.params.id).get();
    if (!plant.exists) return res.status(404).json({ error: 'Plant not found' });
    const snap = await userSoilTests(req.userId, req.params.id).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /plants/:id/soil-tests
app.post('/plants/:id/soil-tests', requireUser, async (req, res) => {
  try {
    const plant = await userPlants(req.userId).doc(req.params.id).get();
    if (!plant.exists) return res.status(404).json({ error: 'Plant not found' });
    const { source, ph, ec, nitrogenPpm, phosphorusPpm, potassiumPpm, organicMatterPct, texture, notes } = req.body || {};
    if (source && !SOIL_SOURCES.has(source)) {
      return res.status(400).json({ error: `source must be one of: ${[...SOIL_SOURCES].join(', ')}` });
    }
    if (texture && !TEXTURE_OPTIONS.has(texture)) {
      return res.status(400).json({ error: `texture must be one of: ${[...TEXTURE_OPTIONS].join(', ')}` });
    }
    const now = new Date().toISOString();
    const data = {
      recordedAt: now,
      source: source || 'visual',
      ph: ph != null ? Number(ph) : null,
      ec: ec != null ? Number(ec) : null,
      nitrogenPpm: nitrogenPpm != null ? Number(nitrogenPpm) : null,
      phosphorusPpm: phosphorusPpm != null ? Number(phosphorusPpm) : null,
      potassiumPpm: potassiumPpm != null ? Number(potassiumPpm) : null,
      organicMatterPct: organicMatterPct != null ? Number(organicMatterPct) : null,
      texture: texture || null,
      notes: notes?.trim() || null,
      createdAt: now,
    };
    const ref = await userSoilTests(req.userId, req.params.id).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /plants/:id/soil-tests/:testId
app.delete('/plants/:id/soil-tests/:testId', requireUser, async (req, res) => {
  try {
    const ref = userSoilTests(req.userId, req.params.id).doc(req.params.testId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Soil test not found' });
    await ref.delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /plants/:id/amendments
app.get('/plants/:id/amendments', requireUser, async (req, res) => {
  try {
    const plant = await userPlants(req.userId).doc(req.params.id).get();
    if (!plant.exists) return res.status(404).json({ error: 'Plant not found' });
    const snap = await userAmendments(req.userId, req.params.id).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /plants/:id/amendments
app.post('/plants/:id/amendments', requireUser, async (req, res) => {
  try {
    const plant = await userPlants(req.userId).doc(req.params.id).get();
    if (!plant.exists) return res.status(404).json({ error: 'Plant not found' });
    const { kind, qty, qtyUnit, targetMetric, notes } = req.body || {};
    if (!kind || !AMENDMENT_KINDS.has(kind)) {
      return res.status(400).json({ error: `kind must be one of: ${[...AMENDMENT_KINDS].join(', ')}` });
    }
    const now = new Date().toISOString();
    const data = {
      appliedAt: now,
      kind,
      qty: qty != null ? Number(qty) : null,
      qtyUnit: qtyUnit?.trim() || null,
      targetMetric: targetMetric?.trim() || null,
      notes: notes?.trim() || null,
      createdAt: now,
    };
    const ref = await userAmendments(req.userId, req.params.id).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /plants/:id/amendments/:amendmentId
app.delete('/plants/:id/amendments/:amendmentId', requireUser, async (req, res) => {
  try {
    const ref = userAmendments(req.userId, req.params.id).doc(req.params.amendmentId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Amendment not found' });
    await ref.delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /propagation/stats — success-rate analytics by species, method, month + top mothers
app.get('/propagation/stats', requireUser, async (req, res) => {
  try {
    const [propSnap, plantSnap] = await Promise.all([
      userPropagations(req.userId).get(),
      userPlants(req.userId).get(),
    ]);

    const propagations = propSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const plants = plantSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const plantById = Object.fromEntries(plants.map(p => [p.id, p]));

    const GOOD_HEALTH = new Set(['Good', 'Excellent']);
    const SURVIVAL_MS = 90 * 86400000;
    const now = Date.now();

    function isSurvived(prop) {
      const child = plants.find(p => p.parentPropagationId === prop.id);
      if (!child) return false;
      if (!GOOD_HEALTH.has(child.health)) return false;
      const created = new Date(child.createdAt || prop.startDate).getTime();
      return now - created >= SURVIVAL_MS;
    }

    const bySpecies = {};
    const byMethod = {};
    const byMonth = {};
    const motherTotal = {};
    const motherSucceeded = {};

    for (const prop of propagations) {
      if (!['transplanted', 'failed'].includes(prop.status)) continue;
      const success = prop.status === 'transplanted' && isSurvived(prop);

      const sp = prop.species || 'Unknown';
      bySpecies[sp] = bySpecies[sp] || { total: 0, succeeded: 0 };
      bySpecies[sp].total++;
      if (success) bySpecies[sp].succeeded++;

      const mt = prop.method || 'unknown';
      byMethod[mt] = byMethod[mt] || { total: 0, succeeded: 0 };
      byMethod[mt].total++;
      if (success) byMethod[mt].succeeded++;

      const mo = (prop.startDate || '').slice(0, 7) || 'unknown';
      byMonth[mo] = byMonth[mo] || { total: 0, succeeded: 0 };
      byMonth[mo].total++;
      if (success) byMonth[mo].succeeded++;

      if (prop.parentPlantId) {
        motherTotal[prop.parentPlantId] = (motherTotal[prop.parentPlantId] || 0) + 1;
        if (success) motherSucceeded[prop.parentPlantId] = (motherSucceeded[prop.parentPlantId] || 0) + 1;
      }
    }

    const rate = (s, t) => t > 0 ? Math.round((s / t) * 100) : 0;

    const topMothers = Object.entries(motherTotal)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([plantId, childrenCount]) => ({
        plantId,
        name: plantById[plantId]?.name || null,
        species: plantById[plantId]?.species || null,
        childrenCount,
        survivalRate: rate(motherSucceeded[plantId] || 0, childrenCount),
      }));

    res.status(200).json({
      successRateBySpecies: Object.entries(bySpecies).map(([species, v]) => ({ species, ...v, rate: rate(v.succeeded, v.total) })),
      successRateByMethod: Object.entries(byMethod).map(([method, v]) => ({ method, ...v, rate: rate(v.succeeded, v.total) })),
      successRateByMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v, rate: rate(v.succeeded, v.total) })),
      topMothers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /plants/:id/substrate-changes
app.get('/plants/:id/substrate-changes', requireUser, async (req, res) => {
  try {
    const plant = await userPlants(req.userId).doc(req.params.id).get();
    if (!plant.exists) return res.status(404).json({ error: 'Plant not found' });
    const snap = await userSubstrateChanges(req.userId, req.params.id).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /plants/:id/substrate-changes
app.post('/plants/:id/substrate-changes', requireUser, async (req, res) => {
  try {
    const plant = await userPlants(req.userId).doc(req.params.id).get();
    if (!plant.exists) return res.status(404).json({ error: 'Plant not found' });
    const { newSubstrate, ratio, reason, notes } = req.body || {};
    if (!newSubstrate?.trim()) return res.status(400).json({ error: 'newSubstrate is required' });
    const now = new Date().toISOString();
    const data = {
      occurredAt: now,
      newSubstrate: newSubstrate.trim(),
      ratio: ratio?.trim() || null,
      reason: reason?.trim() || null,
      notes: notes?.trim() || null,
      createdAt: now,
    };
    const ref = await userSubstrateChanges(req.userId, req.params.id).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /plants/:id/soil-insight — rule-based pH/NPK verdict + Gemini rationale
app.get('/plants/:id/soil-insight', requireUser, async (req, res) => {
  try {
    const plantDoc = await userPlants(req.userId).doc(req.params.id).get();
    if (!plantDoc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = plantDoc.data();

    const testsSnap = await userSoilTests(req.userId, req.params.id).get();
    const tests = testsSnap.docs.map(d => d.data()).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    const latest = tests[0];

    if (!latest || latest.ph == null) {
      return res.status(200).json({ verdict: 'unknown', severity: 'none', recommendedAmendment: null, rationale: 'No soil test data available yet.' });
    }

    const ph = latest.ph;
    let verdict = 'ideal';
    let severity = 'none';
    let amendmentKind = null;

    // Generic pH bands (7.0 is neutral; most plants prefer 6.0–7.0)
    if (ph < 5.5) { verdict = 'low'; severity = ph < 4.5 ? 'high' : 'medium'; amendmentKind = 'lime'; }
    else if (ph > 7.5) { verdict = 'high'; severity = ph > 8.5 ? 'high' : 'medium'; amendmentKind = 'sulphur'; }

    const recommendedAmendment = amendmentKind ? { kind: amendmentKind } : null;

    // Use Gemini for a human-readable rationale if available
    let rationale = verdict === 'ideal'
      ? `pH ${ph} is within the healthy range for most plants.`
      : `pH ${ph} is ${verdict === 'low' ? 'too acidic' : 'too alkaline'}${plant.species ? ` for ${plant.species}` : ''}.`;

    try {
      const prompt = `A plant${plant.species ? ` (${plant.species})` : ''} has a soil pH of ${ph}. In one sentence, explain what this means for the plant and what amendment to use. Be concise and practical.`;
      const result = await geminiWithRetry({ contents: [{ parts: [{ text: prompt }] }] });
      const text = result.response.candidates[0].content.parts[0].text.trim();
      if (text) rationale = text;
    } catch { /* fallback to heuristic */ }

    res.status(200).json({ verdict, severity, ph, recommendedAmendment, rationale });
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

// ── Lifecycle (repotting & pruning) ────────────────────────────────────────

// Default repot intervals in months by species keyword
const REPOT_DEFAULTS = {
  monstera: 18, pothos: 12, fern: 12, orchid: 24, cactus: 36, succulent: 36,
  snake: 24, spider: 12, peace: 18, fiddle: 12, rubber: 18, ivy: 12,
};

function defaultRepotIntervalMonths(species) {
  if (!species) return 18;
  const s = species.toLowerCase();
  for (const [key, months] of Object.entries(REPOT_DEFAULTS)) {
    if (s.includes(key)) return months;
  }
  return 18;
}

app.get('/plants/:id/lifecycle', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = doc.data();
    const repotInterval = plant.repotIntervalMonths || defaultRepotIntervalMonths(plant.species);
    const now = Date.now();
    let repotDaysOverdue = null;
    if (plant.lastRepotted) {
      const nextRepot = new Date(plant.lastRepotted).getTime() + repotInterval * 30 * 86400000;
      repotDaysOverdue = Math.ceil((now - nextRepot) / 86400000);
    }
    let pruneDaysOverdue = null;
    const pruneInterval = plant.pruneIntervalMonths || 6;
    if (plant.lastPruned) {
      const nextPrune = new Date(plant.lastPruned).getTime() + pruneInterval * 30 * 86400000;
      pruneDaysOverdue = Math.ceil((now - nextPrune) / 86400000);
    }
    res.status(200).json({
      lastRepotted: plant.lastRepotted || null,
      repotIntervalMonths: repotInterval,
      repotDaysOverdue,
      lastPruned: plant.lastPruned || null,
      pruneIntervalMonths: pruneInterval,
      pruneDaysOverdue,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/lifecycle/repot', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const { date, notes, newPotSize } = req.body;
    const repottedAt = date || new Date().toISOString();
    const update = { lastRepotted: repottedAt, updatedAt: new Date().toISOString() };
    if (newPotSize) update.potSize = newPotSize;
    if (req.body.repotIntervalMonths) update.repotIntervalMonths = req.body.repotIntervalMonths;
    // Append to phenology log for history
    const plant = doc.data();
    const phenologyEntry = {
      id: `repot-${Date.now()}`,
      event: 'repotting',
      date: repottedAt,
      notes: notes || null,
      newPotSize: newPotSize || null,
    };
    await ref.set({
      ...update,
      phenologyLog: [...(plant.phenologyLog || []), phenologyEntry],
    }, { merge: true });
    res.status(201).json({ repottedAt, notes, newPotSize });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/lifecycle/prune', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const { date, notes, pruneType } = req.body;
    const prunedAt = date || new Date().toISOString();
    const update = { lastPruned: prunedAt, updatedAt: new Date().toISOString() };
    if (req.body.pruneIntervalMonths) update.pruneIntervalMonths = req.body.pruneIntervalMonths;
    const plant = doc.data();
    const phenologyEntry = {
      id: `prune-${Date.now()}`,
      event: 'pruning',
      date: prunedAt,
      notes: notes || null,
      pruneType: pruneType || 'light',
    };
    await ref.set({
      ...update,
      phenologyLog: [...(plant.phenologyLog || []), phenologyEntry],
    }, { merge: true });
    res.status(201).json({ prunedAt, notes, pruneType });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bloom tracking ─────────────────────────────────────────────────────────

app.get('/plants/:id/blooms', requireUser, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = doc.data();
    const blooms = (plant.bloomLog || []).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    res.status(200).json(blooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/blooms', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const { startedAt, colors, notes, count } = req.body;
    const bloom = {
      id: `bloom-${Date.now()}`,
      startedAt: startedAt || new Date().toISOString(),
      endedAt: null,
      colors: colors || [],
      notes: notes || null,
      count: count || null,
    };
    const plant = doc.data();
    await ref.set({ bloomLog: [...(plant.bloomLog || []), bloom] }, { merge: true });
    res.status(201).json(bloom);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/plants/:id/blooms/:bloomId', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = doc.data();
    const bloomLog = (plant.bloomLog || []).map((b) =>
      b.id === req.params.bloomId ? { ...b, ...req.body, id: b.id } : b
    );
    await ref.set({ bloomLog }, { merge: true });
    const updated = bloomLog.find((b) => b.id === req.params.bloomId);
    if (!updated) return res.status(404).json({ error: 'Bloom not found' });
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/blooms/:bloomId/end', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = doc.data();
    const endedAt = req.body?.endedAt || new Date().toISOString();
    const bloomLog = (plant.bloomLog || []).map((b) =>
      b.id === req.params.bloomId ? { ...b, endedAt } : b
    );
    await ref.set({ bloomLog }, { merge: true });
    res.status(200).json({ endedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Account management ────────────────────────────────────────────────────────

async function deleteSubCollection(collRef) {
  const snap = await collRef.get();
  await Promise.all(snap.docs.map((d) => collRef.doc(d.id).delete()));
}

app.delete('/account', requireUser, async (req, res) => {
  try {
    const userId = req.userId;
    const plantsRef = userPlants(userId);
    const plantsSnap = await plantsRef.get();

    const imagesToDelete = [];
    for (const plantDoc of plantsSnap.docs) {
      const plant = plantDoc.data();
      if (plant.imageUrl) imagesToDelete.push(gcsPath(plant.imageUrl));
      for (const entry of (plant.photoLog || [])) {
        if (entry.url) imagesToDelete.push(gcsPath(entry.url));
      }
      const plantRef = plantsRef.doc(plantDoc.id);
      await deleteSubCollection(plantRef.collection('measurements'));
      await deleteSubCollection(plantRef.collection('phenology'));
      await deleteSubCollection(plantRef.collection('journal'));
      await deleteSubCollection(plantRef.collection('harvests'));
      await plantRef.delete();
    }

    const configRef = userConfig(userId);
    await configRef.doc('floors').delete();
    await configRef.doc('floorplan').delete();

    await Promise.all(
      imagesToDelete.filter(Boolean).map((path) =>
        storage.bucket(IMAGES_BUCKET).file(path).delete().catch(() => {}),
      ),
    );

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/account/trial/start', requireUser, async (req, res) => {
  try {
    const subRef = db.collection('users').doc(req.userId).collection('subscription').doc('current');
    const snap = await subRef.get();
    // Only start trial for users with no subscription yet
    if (snap.exists) {
      return res.status(200).json({ alreadyExists: true });
    }
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await subRef.set({
      tier: 'free',
      isTrial: true,
      trialTier: 'home_pro',
      trialEnd,
      status: 'trialing',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ isTrial: true, trialEnd, trialDaysRemaining: 7 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/account/export', requireUser, async (req, res) => {
  try {
    const userId = req.userId;
    const plantsRef = userPlants(userId);
    const plantsSnap = await plantsRef.get();

    const plants = await Promise.all(
      plantsSnap.docs.map(async (plantDoc) => {
        const plant = { id: plantDoc.id, ...plantDoc.data() };
        const plantRef = plantsRef.doc(plantDoc.id);

        const [measurementsSnap, phenologySnap, journalSnap] = await Promise.all([
          plantRef.collection('measurements').get(),
          plantRef.collection('phenology').get(),
          plantRef.collection('journal').get(),
        ]);

        plant.measurements = measurementsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        plant.phenologyEvents = phenologySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        plant.journalEntries = journalSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Strip signed URL query params — export raw GCS paths
        if (plant.imageUrl) plant.imageUrl = plant.imageUrl.split('?')[0];
        if (plant.photoLog) {
          plant.photoLog = plant.photoLog.map((e) => ({ ...e, url: e.url?.split('?')[0] }));
        }
        return plant;
      }),
    );

    const floorsDoc = await userConfig(userId).doc('floors').get();
    const floors = floorsDoc.exists ? floorsDoc.data().floors : [];

    res.status(200).json({
      exportedAt: new Date().toISOString(),
      userId,
      plants,
      floors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Propagation tracker ───────────────────────────────────────────────────────
const PROPAGATION_METHODS = new Set(['seed', 'cutting', 'division', 'layering', 'grafting']);
const PROPAGATION_STATUSES = new Set(['sown', 'germinated', 'rooted', 'ready', 'transplanted', 'failed']);

// Allowed next-statuses per method (state machine)
const PROPAGATION_TRANSITIONS = {
  seed:     ['sown', 'germinated', 'ready', 'transplanted', 'failed'],
  cutting:  ['rooted', 'ready', 'transplanted', 'failed'],
  division: ['rooted', 'ready', 'transplanted', 'failed'],
  layering: ['rooted', 'ready', 'transplanted', 'failed'],
  grafting: ['rooted', 'ready', 'transplanted', 'failed'],
};

function initialStatus(method) {
  return method === 'seed' ? 'sown' : 'rooted';
}

// GET /propagations — list all batches for the current user
app.get('/propagations', requireUser, async (req, res) => {
  try {
    const snap = await userPropagations(req.userId)
      .orderBy('startDate', 'desc')
      .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /propagations — create a propagation batch
app.post('/propagations', requireUser, async (req, res) => {
  try {
    const { method, species, source, startDate, batchSize, expectedDays, notes, parentPlantId } = req.body;
    if (!method || !PROPAGATION_METHODS.has(method)) {
      return res.status(400).json({ error: `method must be one of: ${[...PROPAGATION_METHODS].join(', ')}` });
    }
    if (!species || typeof species !== 'string' || !species.trim()) {
      return res.status(400).json({ error: 'species is required' });
    }
    const now = new Date().toISOString();
    const data = {
      method,
      species: species.trim(),
      source: source?.trim() || null,
      startDate: startDate || now.slice(0, 10),
      batchSize: Number(batchSize) > 0 ? Number(batchSize) : 1,
      expectedDays: expectedDays ? Number(expectedDays) : null,
      status: initialStatus(method),
      notes: notes?.trim() || null,
      parentPlantId: parentPlantId || null,
      createdAt: now,
      updatedAt: now,
    };
    const ref = await userPropagations(req.userId).add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /propagations/:id — update fields or advance status
app.put('/propagations/:id', requireUser, async (req, res) => {
  try {
    const ref = userPropagations(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Propagation not found' });

    const current = doc.data();
    const allowed = ['species', 'source', 'batchSize', 'expectedDays', 'notes', 'status', 'startDate'];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    if (updates.status) {
      if (!PROPAGATION_STATUSES.has(updates.status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${[...PROPAGATION_STATUSES].join(', ')}` });
      }
      const validNext = PROPAGATION_TRANSITIONS[current.method] || [];
      if (!validNext.includes(updates.status)) {
        return res.status(400).json({ error: `Status '${updates.status}' is not valid for method '${current.method}'` });
      }
    }

    updates.updatedAt = new Date().toISOString();
    await ref.set(updates, { merge: true });
    res.status(200).json({ id: doc.id, ...current, ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /propagations/:id/promote — promote batch to one or more Plant records
app.post('/propagations/:id/promote', requireUser, async (req, res) => {
  try {
    const propRef = userPropagations(req.userId).doc(req.params.id);
    const propDoc = await propRef.get();
    if (!propDoc.exists) return res.status(404).json({ error: 'Propagation not found' });

    const prop = propDoc.data();
    const { name, room, floor, x, y, count = 1 } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required for the new plant' });

    const now = new Date().toISOString();
    const newPlants = [];

    for (let i = 0; i < Math.min(Number(count) || 1, prop.batchSize); i++) {
      const plantName = count > 1 ? `${name.trim()} ${i + 1}` : name.trim();
      const plantData = {
        name: plantName,
        species: prop.species,
        room: room || null,
        floor: floor || null,
        x: x || null,
        y: y || null,
        health: 'Good',
        parentPropagationId: propDoc.id,
        parentPlantId: prop.parentPlantId || null,
        createdAt: now,
        updatedAt: now,
      };
      const plantRef = await userPlants(req.userId).add(plantData);
      newPlants.push({ id: plantRef.id, ...plantData });
    }

    // Mark propagation as transplanted
    await propRef.set({ status: 'transplanted', updatedAt: now }, { merge: true });

    res.status(201).json({ promoted: newPlants, propagation: { id: propDoc.id, ...prop, status: 'transplanted' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /propagations/:id
app.delete('/propagations/:id', requireUser, async (req, res) => {
  try {
    const ref = userPropagations(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Propagation not found' });
    await ref.delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /recommend-propagation — Gemini-powered germination / rooting protocol
app.post('/recommend-propagation', requireUser, async (req, res) => {
  try {
    const { species, method } = req.body;
    if (!species || !method) return res.status(400).json({ error: 'species and method are required' });

    const prompt = `You are a propagation expert. Give a concise propagation protocol for "${species}" using the "${method}" method.
Return ONLY valid JSON matching this schema:
{
  "temperatureC": { "min": number, "max": number },
  "mediumRecommendation": "string (e.g. 'perlite/peat mix')",
  "humidityPercent": number,
  "lightRequirement": "string (e.g. 'bright indirect')",
  "expectedDays": number,
  "steps": ["step 1", "step 2", "step 3", "step 4"],
  "successTips": ["tip 1", "tip 2"],
  "commonFailures": ["failure 1", "failure 2"]
}`;

    const result = await geminiWithRetry({ contents: [{ parts: [{ text: prompt }] }] });
    const text = result.response.candidates[0].content.parts[0].text;
    const protocol = parseGeminiJson(text);
    res.status(200).json({ species, method, protocol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Data export (CSV + printable HTML) ───────────────────────────────────────

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(h => csvEscape(h.label)).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h.key])).join(','));
  }
  return lines.join('\n');
}

// GET /export/plants?format=csv|json — plant inventory (home_pro+)
app.get('/export/plants', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    const snap = await userPlants(req.userId).get();
    const plants = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (req.query.format === 'csv') {
      const HEADERS = [
        { key: 'id',                  label: 'ID' },
        { key: 'name',                label: 'Name' },
        { key: 'species',             label: 'Species' },
        { key: 'room',                label: 'Room' },
        { key: 'floor',               label: 'Floor' },
        { key: 'health',              label: 'Health' },
        { key: 'maturity',            label: 'Maturity' },
        { key: 'frequencyDays',       label: 'Watering Frequency (days)' },
        { key: 'lastWatered',         label: 'Last Watered' },
        { key: 'lastFertilised',      label: 'Last Fertilised' },
        { key: 'potSize',             label: 'Pot Size' },
        { key: 'soilType',            label: 'Soil Type' },
        { key: 'plantedIn',           label: 'Planted In' },
        { key: 'isOutdoor',           label: 'Outdoor' },
        { key: 'parentPropagationId', label: 'Parent Propagation ID' },
        { key: 'notes',               label: 'Notes' },
      ];
      const csv = toCsv(HEADERS, plants);
      const filename = `plant-tracker-plants-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    res.status(200).json(plants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /export/watering-history?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD (home_pro+)
app.get('/export/watering-history', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    const fromDate = req.query.from ? new Date(req.query.from) : null;
    const toDate   = req.query.to   ? new Date(req.query.to)   : null;

    const snap = await userPlants(req.userId).get();
    const rows = [];
    for (const doc of snap.docs) {
      const plant = { id: doc.id, ...doc.data() };
      for (const entry of plant.wateringLog || []) {
        const d = new Date(entry.date);
        if (fromDate && d < fromDate) continue;
        if (toDate   && d > toDate)   continue;
        rows.push({
          date:      entry.date,
          plantName: plant.name,
          species:   plant.species || '',
          room:      plant.room    || '',
          method:    entry.method  || '',
          amount:    entry.amount  || '',
          notes:     entry.notes   || '',
          plantId:   plant.id,
        });
      }
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    if (req.query.format === 'csv') {
      const HEADERS = [
        { key: 'date',      label: 'Date' },
        { key: 'plantName', label: 'Plant Name' },
        { key: 'species',   label: 'Species' },
        { key: 'room',      label: 'Room' },
        { key: 'method',    label: 'Method' },
        { key: 'amount',    label: 'Amount' },
        { key: 'notes',     label: 'Notes' },
        { key: 'plantId',   label: 'Plant ID' },
      ];
      const csv = toCsv(HEADERS, rows);
      const filename = `plant-tracker-watering-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.status(200).send(csv);
    }

    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /export/care-schedule?format=html — printable care schedule (home_pro+)
app.get('/export/care-schedule', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    const snap = await userPlants(req.userId).get();
    const plants = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.frequencyDays)
      .sort((a, b) => (a.room || '').localeCompare(b.room || '') || (a.name || '').localeCompare(b.name || ''));

    const today = new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    const rows = plants.map(p => {
      const lastW = p.lastWatered
        ? new Date(p.lastWatered).toLocaleDateString('en-GB') : '—';
      const nextW = p.lastWatered && p.frequencyDays
        ? new Date(new Date(p.lastWatered).getTime() + p.frequencyDays * 86400000).toLocaleDateString('en-GB')
        : '—';
      return `<tr><td>${p.name||''}</td><td>${p.species||''}</td><td>${p.room||''}</td>`
           + `<td>${p.frequencyDays}d</td><td>${lastW}</td><td>${nextW}</td><td>${p.health||''}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Plant Care Schedule</title>
<style>body{font-family:system-ui,sans-serif;font-size:13px;color:#111;margin:24px}
h1{font-size:20px;margin-bottom:4px}p.sub{color:#666;font-size:11px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}th{background:#f0f0f0;text-align:left;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
td{padding:5px 8px;border-bottom:1px solid #e5e5e5}@media print{body{margin:0}}</style>
</head><body>
<h1>Plant Care Schedule</h1>
<p class="sub">Generated ${today} &mdash; ${plants.length} plant${plants.length!==1?'s':''}</p>
<table><thead><tr><th>Name</th><th>Species</th><th>Room</th><th>Water every</th><th>Last watered</th><th>Next due</th><th>Health</th></tr></thead>
<tbody>${rows}</tbody></table></body></html>`;

    const filename = `plant-tracker-schedule-${new Date().toISOString().slice(0, 10)}.html`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.query.format === 'html') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CSV / XLSX bulk plant import ─────────────────────────────────────────────

const IMPORT_COLUMN_MAP = {
  name: ['name', 'plant name', 'plant'],
  species: ['species', 'type', 'plant type', 'scientific name'],
  room: ['room', 'location', 'area'],
  floor: ['floor', 'level'],
  health: ['health', 'health status', 'condition'],
  frequencyDays: ['frequencydays', 'frequency days', 'frequency', 'water every', 'watering frequency'],
  potSize: ['potsize', 'pot size', 'pot'],
  soilType: ['soiltype', 'soil type', 'soil'],
  notes: ['notes', 'note', 'comments', 'description'],
};

const VALID_HEALTH_VALUES = new Set(['Excellent', 'Good', 'Fair', 'Poor']);

function fuzzyMapHeaders(headers) {
  const map = {};
  for (const header of headers) {
    const normalised = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(IMPORT_COLUMN_MAP)) {
      if (aliases.includes(normalised) && !(field in map)) {
        map[field] = header;
        break;
      }
    }
  }
  return map;
}

function validateAndMapRow(rawRow, headerMap, rowIndex) {
  const errors = [];
  const plant = {};

  const name = rawRow[headerMap.name];
  if (!name || !String(name).trim()) {
    return { plant: null, error: { row: rowIndex + 1, reason: 'Missing required field: name' } };
  }
  plant.name = String(name).trim();

  if (headerMap.species && rawRow[headerMap.species]) {
    plant.species = String(rawRow[headerMap.species]).trim();
  }
  if (headerMap.room && rawRow[headerMap.room]) {
    plant.room = String(rawRow[headerMap.room]).trim();
  }
  if (headerMap.floor && rawRow[headerMap.floor]) {
    plant.floor = String(rawRow[headerMap.floor]).trim();
  }
  if (headerMap.health && rawRow[headerMap.health]) {
    const health = String(rawRow[headerMap.health]).trim();
    const normalised = health.charAt(0).toUpperCase() + health.slice(1).toLowerCase();
    if (!VALID_HEALTH_VALUES.has(normalised)) {
      errors.push({ row: rowIndex + 1, reason: `Invalid health value "${health}" — must be Excellent, Good, Fair, or Poor` });
    } else {
      plant.health = normalised;
    }
  }
  if (headerMap.frequencyDays && rawRow[headerMap.frequencyDays]) {
    const freq = parseInt(rawRow[headerMap.frequencyDays], 10);
    if (isNaN(freq) || freq < 1 || freq > 365) {
      errors.push({ row: rowIndex + 1, reason: `Invalid frequencyDays "${rawRow[headerMap.frequencyDays]}" — must be 1–365` });
    } else {
      plant.frequencyDays = freq;
    }
  }
  if (headerMap.potSize && rawRow[headerMap.potSize]) {
    plant.potSize = String(rawRow[headerMap.potSize]).trim();
  }
  if (headerMap.soilType && rawRow[headerMap.soilType]) {
    plant.soilType = String(rawRow[headerMap.soilType]).trim();
  }
  if (headerMap.notes && rawRow[headerMap.notes]) {
    plant.notes = String(rawRow[headerMap.notes]).trim();
  }

  if (errors.length > 0) return { plant: null, error: errors[0] };
  return { plant, error: null };
}

async function parseImportFile(fileBase64, fileName) {
  const buffer = Buffer.from(fileBase64, 'base64');
  const ext = (fileName || '').split('.').pop().toLowerCase();

  if (ext === 'csv') {
    const { parse } = require('csv-parse/sync');
    const records = parse(buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return { headers: records.length > 0 ? Object.keys(records[0]) : [], rows: records };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { headers: [], rows: [] };
    const headers = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
      headers.push(String(cell.value ?? '').trim());
    });
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData = {};
      headers.forEach((header, i) => {
        const cell = row.getCell(i + 1);
        rowData[header] = String(cell.value ?? '').trim();
      });
      rows.push(rowData);
    });
    return { headers, rows };
  }

  throw new Error('Unsupported file type — only .csv and .xlsx/.xls are accepted');
}

// POST /import/plants — bulk import from CSV or XLSX (home_pro+)
app.post('/import/plants', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    const { fileBase64, fileName } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: 'fileBase64 is required' });
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });

    let parsed;
    try {
      parsed = await parseImportFile(fileBase64, fileName);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const { headers, rows } = parsed;
    if (rows.length === 0) return res.status(400).json({ error: 'File contains no data rows' });

    const headerMap = fuzzyMapHeaders(headers);
    if (!headerMap.name) {
      return res.status(400).json({ error: 'Could not detect a "name" column — check column headers match the template' });
    }

    const now = new Date().toISOString();
    const plantsRef = userPlants(req.userId);
    const errors = [];
    let imported = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const { plant, error } = validateAndMapRow(rows[i], headerMap, i);
      if (error) {
        errors.push(error);
        skipped++;
        continue;
      }
      const data = { ...plant, shortCode: generateShortCode(), createdAt: now, updatedAt: now };
      await plantsRef.add(data);
      imported++;
    }

    res.status(200).json({ imported, skipped, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API key management ────────────────────────────────────────────────────────
// Keys are stored in two places for efficient lookup:
//   apiKeyHashes/{sha256hash}  — top-level, fast lookup by hash in requireApiKey
//   users/{userId}/apiKeys/{docId} — user-scoped, for listing/revocation UI

function userApiKeys(userId) {
  return db.collection('users').doc(userId).collection('apiKeys');
}

function apiKeyHashesRef() {
  return db.collection('apiKeyHashes');
}

function generateApiKey() {
  return `pt_live_${crypto.randomBytes(24).toString('hex')}`;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function maskApiKey(prefix) {
  return `${prefix}...`;
}

// Middleware: authenticate via x-plant-api-key header, resolve userId.
// API keys belong to the Google sub that created them; the request operates
// against that sub's *active* household (so a member who issues a key sees
// the same data they see in the UI). Read-only by default; writes still go
// through requireRole() on the route.
async function requireApiKey(req, res, next) {
  const rawKey = req.headers['x-plant-api-key'];
  if (!rawKey) return res.status(401).json({ error: 'Missing x-plant-api-key header' });

  const hash = hashApiKey(rawKey);
  try {
    const hashDoc = await apiKeyHashesRef().doc(hash).get();
    if (!hashDoc.exists || hashDoc.data().revokedAt) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }
    const ownerSub = hashDoc.data().userId;
    // Update lastUsedAt asynchronously — do not block request
    apiKeyHashesRef().doc(hash).set({ lastUsedAt: new Date().toISOString() }, { merge: true }).catch(() => {});

    // Resolve the actor's active household so /api/v1/plants returns the
    // shared data they see in the UI (not just their personal tree).
    const ctx = await households.resolveHouseholdContext(db, ownerSub, null);
    req.actorUserId = ctx.actorUserId;
    req.userId = ctx.userId;
    req.householdId = ctx.householdId;
    req.role = ctx.role;
    next();
  } catch {
    res.status(500).json({ error: 'API key lookup failed' });
  }
}

// Per-user public API rate limiter — 1,000 req/hour (express-rate-limit is no-op in tests)
const publicApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'API rate limit exceeded. Upgrade to a higher tier for more requests.' },
});

// POST /api-keys — create a new API key (max 3 active per user)
app.post('/api-keys', requireUser, requireTier('home_pro'), async (req, res) => {
  try {
    const { name = 'My API Key' } = req.body || {};
    const keysRef = userApiKeys(req.userId);
    const existing = await keysRef.get();
    const active = existing.docs.filter((d) => !d.data().revokedAt);
    if (active.length >= 3) {
      return res.status(400).json({ error: 'Maximum of 3 active API keys allowed. Revoke an existing key first.' });
    }
    const plaintext = generateApiKey();
    const keyHash = hashApiKey(plaintext);
    const prefix = plaintext.slice(0, 12);
    const now = new Date().toISOString();
    const keyName = String(name).trim().slice(0, 64) || 'My API Key';
    const docRef = await keysRef.add({ name: keyName, prefix, keyHash, revokedAt: null, createdAt: now, lastUsedAt: null });
    // Write to top-level hash index for fast lookup
    await apiKeyHashesRef().doc(keyHash).set({ userId: req.userId, revokedAt: null, createdAt: now });
    res.status(201).json({ id: docRef.id, key: plaintext, name: keyName, prefix, createdAt: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /import/plants/template — download CSV template
app.get('/import/plants/template', requireUser, (req, res) => {
  const headers = ['name', 'species', 'room', 'floor', 'health', 'frequencyDays', 'potSize', 'soilType', 'notes'];
  const example = ['Monstera', 'Monstera deliciosa', 'Living Room', 'Ground Floor', 'Good', '7', '20cm', 'Well-draining', 'Near the window'];
  const csv = `${headers.join(',')}\n${example.join(',')}`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="plant-import-template.csv"');
  res.status(200).send(csv);
});

// GET /api-keys — list active API keys (masked, no hash exposed)
app.get('/api-keys', requireUser, async (req, res) => {
  try {
    const snap = await userApiKeys(req.userId).get();
    const keys = snap.docs
      .filter((d) => !d.data().revokedAt)
      .sort((a, b) => (b.data().createdAt || '').localeCompare(a.data().createdAt || ''))
      .map((d) => {
        const { keyHash: _h, ...safe } = d.data();
        return { id: d.id, ...safe, key: maskApiKey(safe.prefix) };
      });
    res.status(200).json({ keys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api-keys/:id — revoke an API key
app.delete('/api-keys/:id', requireUser, async (req, res) => {
  try {
    const ref = userApiKeys(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'API key not found' });
    if (doc.data().revokedAt) return res.status(409).json({ error: 'API key already revoked' });
    const { keyHash } = doc.data();
    const now = new Date().toISOString();
    await ref.set({ revokedAt: now }, { merge: true });
    if (keyHash) await apiKeyHashesRef().doc(keyHash).set({ revokedAt: now }, { merge: true });
    res.status(200).json({ revoked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Public REST API v1 ────────────────────────────────────────────────────────
// These routes accept API key auth (x-plant-api-key) and are rate-limited.

app.get('/api/v1/plants', requireApiKey, publicApiLimiter, async (req, res) => {
  try {
    const snap = await userPlants(req.userId).orderBy('name').get();
    const plants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.status(200).json({ plants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/plants/:id', requireApiKey, publicApiLimiter, async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/plants/:id/water', requireApiKey, publicApiLimiter, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const now = new Date().toISOString();
    await ref.set({ lastWatered: now, updatedAt: now }, { merge: true });
    res.status(200).json({ watered: true, lastWatered: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/plants/:id/care-score', requireApiKey, publicApiLimiter, requireTier('home_pro'), async (req, res) => {
  try {
    const doc = await userPlants(req.userId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = { id: doc.id, ...doc.data() };
    const score = computeCareScore(plant);
    res.status(200).json({ id: plant.id, name: plant.name, ...score });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Dormancy cycle tracking (#307) ───────────────────────────────────────────

app.post('/plants/:id/dormancy/enter', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const now = new Date().toISOString();
    const existing = doc.data();
    const { notes } = req.body || {};

    const dormancyEvents = [...(existing.dormancyEvents || []), {
      enteredAt: now,
      exitedAt: null,
      triggeredBy: 'user',
      notes: notes || '',
    }];

    await ref.set({
      currentPhase: 'dormant',
      dormancyEvents,
      updatedAt: now,
    }, { merge: true });

    res.status(200).json({ currentPhase: 'dormant', enteredAt: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/plants/:id/dormancy/exit', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });

    const now = new Date().toISOString();
    const existing = doc.data();
    const { notes } = req.body || {};

    const dormancyEvents = [...(existing.dormancyEvents || [])];
    // Close the most recent open event
    const lastIdx = dormancyEvents.map((e) => !e.exitedAt).lastIndexOf(true);
    if (lastIdx !== -1) {
      dormancyEvents[lastIdx] = { ...dormancyEvents[lastIdx], exitedAt: now, notes: notes || dormancyEvents[lastIdx].notes };
    }

    await ref.set({
      currentPhase: 'active-growth',
      dormancyEvents,
      updatedAt: now,
    }, { merge: true });

    res.status(200).json({ currentPhase: 'active-growth', exitedAt: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Client read-only portal (#170) ───────────────────────────────────────────
// Landscapers share a signed token link with property owners so they can view
// plant health without a full account.
// Token format: base64url(payload_json).hmac_hex  — signed with PORTAL_SECRET.

const PORTAL_SECRET = process.env.PORTAL_JWT_SECRET || 'portal-dev-secret';
const PORTAL_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function signPortalToken(userId, label) {
  const payload = JSON.stringify({ userId, label: label || 'My Garden', iat: Date.now() });
  const encoded = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', PORTAL_SECRET).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

function verifyPortalToken(token) {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) throw new Error('malformed token');
  const expected = crypto.createHmac('sha256', PORTAL_SECRET).update(encoded).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new Error('invalid signature');
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (Date.now() - payload.iat > PORTAL_TTL_MS) throw new Error('token expired');
  return payload;
}

// Generate a portal link (landscaper only)
app.post('/portal/generate', requireUser, requireTier('landscaper_pro'), async (req, res) => {
  try {
    const { label } = req.body || {};
    const token = signPortalToken(req.userId, label);
    res.status(200).json({ token, portalUrl: `/portal/${token}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public portal data endpoint — no auth cookie, just a valid signed token
app.get('/portal/:token', async (req, res) => {
  try {
    let payload;
    try {
      payload = verifyPortalToken(req.params.token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired portal link' });
    }

    const { userId, label } = payload;
    const snap = await userPlants(userId).orderBy('name').get();
    const plants = await Promise.all(snap.docs.map(async (d) => {
      const p = { id: d.id, ...d.data() };
      await signPlantData(p);
      // Omit internal fields from portal view
      const { wateringLog, moistureLog, feedingLog, healthLog, mlCache, shortCode, ...safe } = p;
      return safe;
    }));

    const floorsDoc = await db.collection('users').doc(userId).collection('config').doc('floors').get();
    const floors = floorsDoc.exists ? (floorsDoc.data().floors || []) : [];

    const brandingDoc = await db.collection('users').doc(userId).collection('config').doc('branding').get();
    const branding = brandingDoc.exists ? brandingDoc.data() : null;

    res.status(200).json({ label, plants, floors, branding });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plant-sitter sessions ───────────────────────────────────────────────────

const SIT_SECRET = process.env.SIT_JWT_SECRET || 'sit-secret-dev-only';

app.post('/sit-sessions', requireUser, async (req, res) => {
  try {
    if (!jwt) return res.status(503).json({ error: 'jwt_unavailable' });
    const { durationDays = 7, plantIds, floorId, sitterName, notes } = req.body;
    const sessionId = `sit-${Date.now()}-${require('crypto').randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();
    const token = jwt.sign(
      { sessionId, userId: req.userId, plantIds: plantIds || null, floorId: floorId || null },
      SIT_SECRET,
      { expiresIn: `${durationDays}d` }
    );
    const sessionDoc = {
      sessionId, token, expiresAt, sitterName: sitterName || null,
      notes: notes || null, status: 'active', createdAt: new Date().toISOString(),
      plantIds: plantIds || null, floorId: floorId || null,
    };
    await db.collection('users').doc(req.userId).collection('sitSessions').doc(sessionId).set(sessionDoc);
    res.status(201).json({ ...sessionDoc, shareUrl: `/sit/${token}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sit-sessions', requireUser, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.userId).collection('sitSessions')
      .orderBy('createdAt', 'desc').limit(20).get();
    res.status(200).json(snap.docs.map((d) => d.data()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/sit-sessions/:sessionId', requireUser, async (req, res) => {
  try {
    await db.collection('users').doc(req.userId).collection('sitSessions')
      .doc(req.params.sessionId).update({ status: 'ended', endedAt: new Date().toISOString() });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public sitter routes — no user auth, token-based
app.get('/sit/:token', async (req, res) => {
  try {
    if (!jwt) return res.status(503).json({ error: 'jwt_unavailable' });
    let decoded;
    try {
      decoded = jwt.verify(req.params.token, SIT_SECRET);
    } catch {
      return res.status(401).json({ error: 'invalid_or_expired_token' });
    }
    const { sessionId, userId, plantIds } = decoded;
    const sessionSnap = await db.collection('users').doc(userId).collection('sitSessions').doc(sessionId).get();
    if (!sessionSnap.exists || sessionSnap.data().status !== 'active') {
      return res.status(404).json({ error: 'session_not_found_or_ended' });
    }
    const session = sessionSnap.data();
    // Get plants
    let plantsData;
    if (plantIds && plantIds.length > 0) {
      const docs = await Promise.all(
        plantIds.map((id) => db.collection('users').doc(userId).collection('plants').doc(id).get())
      );
      plantsData = await Promise.all(
        docs.filter((d) => d.exists).map((d) => signPlantData({ id: d.id, ...d.data() }))
      );
    } else {
      const snap = await db.collection('users').doc(userId).collection('plants').limit(50).get();
      plantsData = await Promise.all(snap.docs.map((d) => signPlantData({ id: d.id, ...d.data() })));
    }
    res.status(200).json({
      sessionId, sitterName: session.sitterName, notes: session.notes,
      expiresAt: session.expiresAt, plants: plantsData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sit/:token/water/:plantId', async (req, res) => {
  try {
    if (!jwt) return res.status(503).json({ error: 'jwt_unavailable' });
    let decoded;
    try {
      decoded = jwt.verify(req.params.token, SIT_SECRET);
    } catch {
      return res.status(401).json({ error: 'invalid_or_expired_token' });
    }
    const { sessionId, userId, plantIds } = decoded;
    const plantId = req.params.plantId;
    if (plantIds && !plantIds.includes(plantId)) {
      return res.status(403).json({ error: 'plant_not_in_session' });
    }
    const sessionSnap = await db.collection('users').doc(userId).collection('sitSessions').doc(sessionId).get();
    if (!sessionSnap.exists || sessionSnap.data().status !== 'active') {
      return res.status(404).json({ error: 'session_ended' });
    }
    const now = new Date().toISOString();
    const ref = db.collection('users').doc(userId).collection('plants').doc(plantId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const plant = doc.data();
    const sitterName = sessionSnap.data().sitterName || 'Sitter';
    const waterEntry = { date: now, method: 'manual', wateredBy: sitterName };
    await ref.set({
      lastWatered: now,
      wateringLog: [...(plant.wateringLog || []).slice(-49), waterEntry],
      updatedAt: now,
    }, { merge: true });
    res.status(201).json({ wateredAt: now, wateredBy: sitterName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

functions.http('plantsApi', app);
