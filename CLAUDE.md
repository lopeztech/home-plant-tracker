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
  → Firebase Hosting (CDN, SPA rewrites)
  → GCP API Gateway (validates x-api-key + Google JWT)
  → Cloud Run Function (Express, api/plants/index.js)
  → Firestore (users/{userId}/plants, users/{userId}/config/floors)
  → Cloud Storage (plant & floorplan photos)
  → Gemini API (plant analysis, care recommendations)
```

**Frontend** (`src/`) is a Vite + React SPA using **Bootstrap 5 + React-Bootstrap** with Smart Admin template SCSS theming. The layout uses Smart's CSS Grid: `app-wrap` → `app-header` (topbar) + `app-sidebar` (sidebar nav) + `app-body` (content). Uses `react-router` for page navigation.

**Layout structure:**
- `src/layouts/MainLayout.jsx` — CSS Grid shell (topbar + sidebar + content + footer)
- `src/layouts/components/Topbar.jsx` — Header bar: logo, weather, theme toggle, profile dropdown
- `src/layouts/components/Sidebar.jsx` — Navigation sidebar with Smart's menu pattern
- `src/context/LayoutContext.jsx` — Theme/sidebar state (light/dark, theme style, nav collapsed)
- `src/context/PlantContext.jsx` — All plant/floor CRUD state (extracted from old App.jsx)

**Pages** (routed via `src/routes/index.jsx`):
- `/` → `DashboardPage.jsx` — Floorplan panel (Leaflet) + Plant list panel
- `/analytics` → `AnalyticsPage.jsx` — ApexCharts: health distribution, watering heatmap, consistency
- `/calendar` → `CalendarPage.jsx` — Monthly care schedule
- `/settings` → `SettingsPage.jsx` — Floor management, theme picker, preferences
- `/login` → `LoginPage.jsx` — Google OAuth + guest mode

**Styling:** Bootstrap 5.3 + Smart Admin SCSS (`src/assets/sass/smartapp.scss`). 9 color themes in `public/css/` (olive is default). Custom app styles in `_plant-tracker.scss` and `_leaflet-overrides.scss`. Icons use Smart's SVG sprite (`public/icons/sprite.svg`) via `<svg><use href="..."></use></svg>`.

**Charts:** ApexCharts via `react-apexcharts`.

**Backend** (`api/plants/index.js`) is a single Express file handling all routes. Auth: the API Gateway injects a decoded JWT as `x-apigateway-api-userinfo` header; locally, the backend falls back to parsing a `Authorization: Bearer` token directly. User isolation is enforced by scoping all Firestore reads/writes to `users/{userId}/`.

**Gemini integration** is in `api/plants/index.js` — `/analyse` and `/analyse-floorplan` send base64 images; responses are JSON-parsed with `jsonrepair` fallback (handles Gemini's occasionally malformed output).

**Auth** is Google OAuth via `@react-oauth/google`. `AuthContext.jsx` stores the credential and passes the ID token as `Authorization: Bearer` on every API request. The login gate is in `MainLayout.jsx` (redirects to `/login` if not authenticated).

**Infrastructure** is managed by Terraform in the `platform-infra` repository. Key resources: Firebase Hosting (frontend SPA), Cloud Run Function (backend), API Gateway (OpenAPI 2.0 spec), Firestore, Cloud Storage, Secret Manager. The GitHub Actions workflow (`deploy.yml`) in this repo deploys the **frontend** to Firebase Hosting via `firebase-tools` CLI (authenticated with WIF). The **backend** Cloud Run Function (`plant-tracker-plants-api`) is deployed from this repo's CI when `api/plants/` files change — it packages a zip, uploads to GCS, and triggers a Terraform apply in `platform-infra`.

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
- **Component pattern:** Use Smart Admin's `panel` / `panel-hdr` / `panel-container` / `panel-content` for card-like containers. Use React-Bootstrap components (`Modal`, `Button`, `Form`, `Card`, `Nav`, `Badge`, `Table`, `Row`, `Col`) for UI elements.
- **Icons:** Use Smart's SVG sprite: `<svg className="sa-icon"><use href="/icons/sprite.svg#icon-name"></use></svg>`. Icon sizes: `sa-icon-2x`, `sa-icon-5x`.
- **Theming:** 9 themes available (olive, earth, aurora, lunar, nebula, night, solar, storm, flare). Selected via `LayoutContext.changeThemeStyle()`. Dark mode via `LayoutContext.changeTheme('dark')`.
- **Test mocks:** Backend tests use proxyquire + in-memory Firestore mock in `index.test.js`. Frontend tests mock `src/api/plants.js`
- **CI/CD:** Tests run on every push/PR; Firebase Hosting deploy + Cloud Function deploy only run on `main` pushes. Do NOT run tests locally — rely on GitHub Actions CI.
- **New API routes:** `POST /recommend-watering` for Gemini-powered watering advice; `POST /recommend` accepts optional `plantedIn` and `isOutdoor` context. New routes must be added to the API Gateway OpenAPI spec in `platform-infra`.
- **Plant fields:** `plantedIn` (ground, garden-bed, pot) controls conditional display of `potSize` and `soilType` in the Plant tab.
