# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (root)
```bash
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # Production build → dist/
npm test             # Run tests once
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report (thresholds: lines 35%, functions 50%, branches 50%)
```

### Backend (api/plants/)
```bash
cd api/plants && npm test        # Run backend tests
cd api/plants && npm run test:watch
```

### Run a single test file
```bash
npx vitest run src/__tests__/PlantModal.test.jsx
cd api/plants && npx vitest run index.test.js
```

### Infrastructure
Infrastructure is managed via Terraform in the **`platform-infra` repository** (separate from this repo).
Any changes to GCP resources (Cloud Run, API Gateway, Firestore, Cloud Storage, IAM, networking) must be made there.
Do NOT modify Terraform files in this repository.

## Architecture

**Request flow:**
```
Browser (React SPA)
  → Cloud Load Balancer + CDN
  → GCP API Gateway (validates x-api-key + Google JWT)
  → Cloud Run Function (Express, api/plants/index.js)
  → Firestore (users/{userId}/plants, users/{userId}/config/floors)
  → Cloud Storage (plant & floorplan photos)
  → Gemini API (plant analysis, care recommendations)
```

**Frontend** (`src/`) is a Vite + React SPA using Tailwind CSS. The main interactive surface is the Leaflet-based floorplan canvas (`LeafletFloorplan.jsx`) where plants are placed as markers. `App.jsx` owns top-level state (plants, floors, selected floor/plant). All API calls go through `src/api/plants.js`.

**Backend** (`api/plants/index.js`) is a single Express file handling all routes. Auth: the API Gateway injects a decoded JWT as `x-apigateway-api-userinfo` header; locally, the backend falls back to parsing a `Authorization: Bearer` token directly. User isolation is enforced by scoping all Firestore reads/writes to `users/{userId}/`.

**Gemini integration** is in `api/plants/index.js` — `/analyse` and `/analyse-floorplan` send base64 images; responses are JSON-parsed with `jsonrepair` fallback (handles Gemini's occasionally malformed output).

**Auth** is Google OAuth via `@react-oauth/google`. `AuthContext.jsx` stores the credential and passes the ID token as `Authorization: Bearer` on every API request. The login gate is in `App.jsx`.

**Infrastructure** is managed by Terraform in the `platform-infra` repository. Key resources: Cloud Run (frontend Docker container with nginx), Cloud Run Function (backend), API Gateway (OpenAPI 2.0 spec), Firestore, Cloud Storage, Secret Manager. The GitHub Actions workflow (`deploy.yml`) in this repo only deploys the **frontend** (Docker image → Cloud Run `plant-tracker`). The **backend** Cloud Run Function (`plant-tracker-plants-api`) is deployed via `platform-infra`.

## Environment Variables

Frontend (`.env.local`, copy from `.env.example`):
```
VITE_GOOGLE_CLIENT_ID=   # OAuth 2.0 Web client ID
VITE_API_BASE_URL=       # API Gateway URL
VITE_API_KEY=            # x-api-key for API Gateway
```

Backend env vars (`IMAGES_BUCKET`, `GEMINI_API_KEY`) are injected by Terraform/Cloud Run — not needed for running tests locally.

## Key Conventions

- **Firestore path:** `users/{userId}/plants/{plantId}` and `users/{userId}/config/floors/{floorId}`
- **Plant positions** (`x`, `y`) are percentage coordinates on the floorplan image (0–100)
- **Watering logic** lives in `src/utils/watering.js`; the backend also stores `lastWatered` as an ISO date string
- **Test mocks:** Backend tests use proxyquire + in-memory Firestore mock in `index.test.js`. Frontend tests mock `src/api/plants.js`
- **CI/CD:** Tests run on every push/PR; Docker build + Cloud Run deploy only runs on `main` pushes
