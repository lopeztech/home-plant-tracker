'use strict';

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { VertexAI } = require('@google-cloud/vertexai');
const express = require('express');
const cors = require('cors');

const db = new Firestore();
const storage = new Storage({
  serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL,
});
const COLLECTION = 'plants';
const CONFIG_COLLECTION = 'config';
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
app.use(express.json());
app.use(cors({
  origin: ['https://plants.lopezcloud.dev', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  optionsSuccessStatus: 204
}));

const vertexAI = new VertexAI({ project: process.env.PROJECT_ID, location: 'us-central1' });
const gemini = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
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
      generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
    });

    const text = result.response.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse Gemini response' });

    const parsed = JSON.parse(jsonMatch[0]);
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

app.get('/config/floors', async (req, res) => {
  try {
    const doc = await db.collection(CONFIG_COLLECTION).doc('floors').get();
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

app.put('/config/floors', async (req, res) => {
  try {
    const { floors } = req.body;
    await db.collection(CONFIG_COLLECTION).doc('floors').set(
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

app.get('/config/floorplan', async (req, res) => {
  try {
    const doc = await db.collection(CONFIG_COLLECTION).doc('floorplan').get();
    const data = doc.exists ? doc.data() : { imageUrl: null };
    data.imageUrl = await signReadUrl(data.imageUrl);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/config/floorplan', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    await db.collection(CONFIG_COLLECTION).doc('floorplan').set(
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

app.get('/plants', async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION)
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

app.post('/plants', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { imageBase64, ...body } = req.body;
    const data = { ...body, createdAt: now, updatedAt: now };
    const docRef = await db.collection(COLLECTION).add(data);
    res.status(201).json({ id: docRef.id, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/plants/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    const data = { id: doc.id, ...doc.data() };
    data.imageUrl = await signReadUrl(data.imageUrl);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/plants/:id', async (req, res) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
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

app.delete('/plants/:id', async (req, res) => {
  try {
    const ref = db.collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Plant not found' });
    await ref.delete();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

functions.http('plantsApi', app);
