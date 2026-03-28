'use strict';

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { jsonrepair } = require('jsonrepair');
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
  const prefix = `https://storage.googleapis.com/${IMAGES_BUCKET}/`;
  return urlOrPath.startsWith(prefix) ? urlOrPath.slice(prefix.length) : urlOrPath;
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

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: ['https://plants.lopezcloud.dev', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));
app.use((req, _res, next) => {
  log.info('request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });


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
  try { return JSON.parse(s); } catch (_) {}

  // Extract the outermost {...} in case Gemini added surrounding prose
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start !== -1 && end > start) s = s.slice(start, end + 1);

  // Sanitize ALL raw control characters (U+0000–U+001F) that are illegal
  // inside JSON strings. Named escapes are used for the five that have them;
  // everything else becomes a \uXXXX sequence.
  const NAMED = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' };
  s = s.replace(/[\x00-\x1f]/g, c => NAMED[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

  try { return JSON.parse(s); } catch (_) {}

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
  "recommendations": ["tip 1", "tip 2", "tip 3"]
}
Rules:
- health must be exactly one of: Excellent, Good, Fair, Poor
- maturity must be exactly one of: Seedling, Young, Mature, Established
- frequencyDays is an integer representing days between waterings
- recommendations must have exactly 3 items
- Respond with JSON only, no markdown or extra text`;

const RECOMMEND_PROMPT = (name, species) =>
  `You are a plant care expert. Provide detailed care guidance for: ${name}${species ? ` (${species})` : ''}.

Respond ONLY with valid JSON:
{
  "summary": "One to two sentence overview of this plant's care needs",
  "watering": "Watering frequency and technique",
  "light": "Ideal light conditions",
  "humidity": "Humidity preferences and tips",
  "soil": "Recommended soil mix",
  "temperature": "Preferred temperature range",
  "fertilising": "Fertilising schedule and type",
  "commonIssues": ["issue 1", "issue 2", "issue 3"],
  "tips": ["tip 1", "tip 2", "tip 3"]
}
Rules:
- All fields are required
- commonIssues and tips must each have 2–4 items
- Be concise and practical
- Respond with JSON only, no markdown fences`;

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── Floorplan analysis via Gemini (Vertex AI) ────────────────────────────────

app.post('/analyse-floorplan', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    const result = await gemini.generateContent({
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
    res.status(500).json({ error: err.message });
  }
});

// ── Plant photo analysis via Gemini (Vertex AI) ───────────────────────────────

app.post('/analyse', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    const result = await gemini.generateContent({
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
    res.status(500).json({ error: err.message });
  }
});

// ── Care recommendations via Gemini ──────────────────────────────────────────

app.post('/recommend', async (req, res) => {
  try {
    const { name, species } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await gemini.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: RECOMMEND_PROMPT(name, species) }],
      }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.3, responseMimeType: 'application/json' },
    });

    const parsed = parseGeminiJson(result.response.text());
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Image upload — returns a signed URL so the browser can PUT directly to GCS

app.post('/images/upload-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
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
    data.imageUrl = await signReadUrl(data.imageUrl);
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
        data.imageUrl = await signReadUrl(data.imageUrl);
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
    const { imageBase64, ...body } = req.body;
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
    data.imageUrl = await signReadUrl(data.imageUrl);
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

    const { imageBase64, ...body } = req.body;
    const updates = { ...body, updatedAt: new Date().toISOString() };
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
    const wateringLog = [...(existing.wateringLog || []), { date: now, note: '' }];

    await ref.set({ lastWatered: now, wateringLog, updatedAt: now }, { merge: true });

    const updated = await ref.get();
    const data = { id: updated.id, ...updated.data() };
    data.imageUrl = await signReadUrl(data.imageUrl);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/plants/:id', requireUser, async (req, res) => {
  try {
    const ref = userPlants(req.userId).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    await ref.delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

functions.http('plantsApi', app);
