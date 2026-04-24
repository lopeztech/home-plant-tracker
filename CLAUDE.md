# CLAUDE.md

Orientation document for Claude Code and any agent (including Claude Routines) picking up work in this repo. Read this before scanning the tree — it is intended to be self-contained.

## What this app is

A **home plant tracker** SPA at `https://plants.lopezcloud.dev`. Users log in with Google, place plants on a 2D/3D floorplan of their home/garden, and get AI-assisted care (watering schedule, fertiliser, health/pest diagnostics, weather-aware alerts). Ships as an installable PWA with offline mutation queue. Billing via Stripe with tier gating (free / home_pro / landscaper_pro) that is dark-shippable. Sells into home gardeners AND landscaping pros (multi-property, client portals, public API, white-label branding).

## Repo layout (top level)

```
api/plants/        Backend Cloud Run Function (Express, single file at index.js + billing/tierGate/vertexai modules)
src/               Frontend React + Vite SPA
public/            Static assets (Smart Admin SVG sprite, 9 theme CSS files, PWA icons)
e2e/               Playwright smoke tests (run against deployed env via E2E_BASE_URL)
docs/              Planning docs (ML roadmap, feature specs)
issues/            Issue-tracking docs
scripts/           Utility shell scripts (e.g., GitHub secrets setup)
terraform/         Legacy / reference only — real infra lives in platform-infra repo
.github/           CI workflows (deploy.yml, codeql.yml)
.storybook/        Storybook 8 config (React-Vite framework)
storybook-static/  Built Storybook (checked in; served separately)
firebase.json      Firebase Hosting config (dist → plant-tracker-prod target)
.firebaserc        Firebase project: home-plant-tracker-lcd
firestore.rules    Deny-all (all access via the Cloud Function)
vite.config.js     Vite + vite-plugin-pwa, Workbox runtime caching, commit/build globals
vitest.config.js   jsdom env, v8 coverage (lines 35, functions 30, branches 35)
DESIGN.md          Design system notes (tokens, motion, typography, palettes)
```

Infrastructure (Cloud Run, API Gateway, Firestore, Cloud Storage, IAM, networking) is managed in the **`platform-infra` repository**. Do NOT modify Terraform files here; the `terraform/` dir in this repo is effectively reference/legacy. New backend routes MUST also be added to the API Gateway OpenAPI spec in `platform-infra` — otherwise the gateway returns 404.

## Request flow

```
Browser (React SPA, PWA)
  → Firebase Hosting (CDN, SPA rewrites to /index.html)
  → GCP API Gateway (validates x-api-key + Google JWT; or x-plant-api-key for public API)
  → Cloud Run Function `plant-tracker-plants-api` (Express, api/plants/index.js, ~4000 lines)
  → Firestore (users/{userId}/plants, .../config/*, .../propagations, .../subscription/current)
  → Cloud Storage (plant & floorplan photos, signed URLs, bucket=$IMAGES_BUCKET)
  → Gemini API (plant/floorplan analysis, care + soil recommendations, pest diagnosis)
  → Vertex AI (anomaly detection, watering pattern, health prediction)
  → Stripe API (checkout, portal, webhooks)
```

Auth on the backend:
- Gateway injects decoded JWT as `x-apigateway-api-userinfo`. Locally, backend falls back to parsing `Authorization: Bearer <id_token>`.
- **Public API** (`/api/v1/*`) uses `x-plant-api-key` header — keys are SHA-256 hashed and looked up via `apiKeyHashes/{hash}` in Firestore. Protected by a separate `publicApiLimiter`.
- User isolation: every Firestore read/write is scoped under `users/{userId}/`. Never query across users.

## Commands

### Frontend (repo root)
```bash
npm run dev                # Vite dev server → http://localhost:5173
npm run build              # Production build → dist/
npm run preview            # Preview built bundle
npm test                   # Vitest run once
npm run test:watch         # Watch mode
npm run test:coverage      # v8 coverage (thresholds: lines 35, functions 30, branches 35)
npm run test:ui            # Vitest UI dashboard
npm run storybook          # Storybook dev → http://localhost:6006
npm run build-storybook    # Static Storybook → storybook-static/
```

### Backend (from `api/plants/`)
```bash
cd api/plants && npm test                 # Unit tests (Vitest)
cd api/plants && npm run test:watch
cd api/plants && npm run test:coverage
cd api/plants && npm run lint             # ESLint on index.js
cd api/plants && npm run test:integration # Firestore emulator integration tests
```

### Single test file
```bash
npx vitest run src/__tests__/PlantModal.test.jsx
cd api/plants && npx vitest run index.test.js
```

> Convention: do NOT run the full test suite locally by default — rely on GitHub Actions CI. Exceptions: `npm run build`, `npm run lint` (in api/plants), `npm audit` before pushing. For Dependabot major-version bumps (including three.js pre-1.0 minor bumps), checkout the branch and attempt a build locally before merging.

## Frontend structure (`src/`)

### Entry / routing
- `src/main.jsx` — React root
- `src/App.jsx` — provider tree + router root
- `src/routes/index.jsx` — React Router v7, lazy-loads all pages. Public routes: `/privacy`, `/terms`, `/scan/:shortCode`. Auth route: `/login`. Protected under `MainLayout`. `/insights` gated by `VITE_ML_INSIGHTS_ENABLED === 'true'`.

### `src/api/plants.js` — single API client
Factory that returns a `request()` helper (adds `x-api-key`, `Authorization: Bearer`, handles offline queueing) plus ~20 grouped APIs:

- `plantsApi` — CRUD + actions: `list`, `create`, `update`, `delete`, `water`, `moisture`, `fertilise`, `deletePhoto`, `recalculateFrequencies`, `shortCode`
- `plantsApi` ML: `wateringPattern`, `wateringRecommendation`, `healthPrediction`, `anomaly`, `diagnostic`, `seasonalAdjustment`, `careScore`, `speciesCluster`
- `floorsApi` — `get`, `save`
- `analyseApi` — `analyse(file)`, `analyseWithHint(file, speciesHint)`, `analyseFloorplan(file)`
- `recommendApi` — `get`, `getWatering`, `getFertiliser`, `getPropagation`
- `measurementsApi`, `phenologyApi`, `journalApi`, `harvestApi` — per-plant logs
- `incidentApi`, `outbreakApi` — pest/disease tracking (single plant + cross-plant outbreak)
- `propagationApi` — CRUD + `stats`, `lineage`, `promote`
- `soilApi` — `listTests`, `createTest`, `deleteTest`, `listAmendments`, `createAmendment`, `listSubstrateChanges`, `createSubstrateChange`, `insight`
- `qrApi` — `shortCode(plantId)`, `resolve(shortCode)`
- `accountApi` — `delete()`, `export()` (GDPR)
- `billingApi` — `getSubscription`, `createCheckoutSession(tier, interval)`, `createPortalSession`
- `exportApi` / `importApi` — home_pro data export (plants, watering history, care schedule) + CSV/Excel import
- `brandingApi` — landscaper_pro white-label config (`get`, `save`)
- `apiKeysApi` — home_pro public API keys (`list`, `create`, `revoke`)
- `imagesApi` — `upload(file, prefix)` — signed-URL, direct PUT to GCS
- Offline glue: `setApiCredential`, `flushOfflineMutations`, `OfflineQueuedError`

### `src/context/` and `src/contexts/` (two dirs, both imported)
- `src/contexts/AuthContext.jsx` — Google OAuth sign-in, `isAuthenticated`, `userId`, `isGuest`, `logout`. Passes ID token on every request.
- `src/context/PlantContext.jsx` — core app state: plants[] + cursor pagination, floors[], activeFloorId, loading/error, weather, offline queue state, and all plant mutations (add/edit/delete/water/fertilise/moisture/bulk create), floorplan load/save, guest-mode fallback.
- `src/context/SubscriptionContext.jsx` — `tier`, `status`, `quotas`, `usage`, `currentPeriodEnd`, `cancelAtPeriodEnd`, plus helpers `canAccess(minTier)`, `getQuotaRemaining(type)`, `isAtQuotaLimit(type)`.
- `src/context/LayoutContext.jsx` — theme (light/dark), theme-style (9 palettes), sidebar collapsed, mobile drawer state.
- `src/context/CommandPaletteContext.jsx` — Cmd+K palette open/close, recent-plants list (localStorage).
- `src/context/TourContext.jsx` — react-joyride feature tour state (active step, seen flags, current tour).
- `src/context/HelpContext.jsx` — help drawer visibility + active article.

### `src/hooks/`
- `useWeather.js` — Open-Meteo geolocation + forecast.
- `useTempUnit.js` — °C/°F pref (tied to unit system).
- `useImageAspect.js` — responsive image sizing.
- `useKeyboardShortcuts.js` — Cmd+K opens command palette; Enter/Escape form hooks.
- `useRtl.js` — detects RTL languages (ar, he, fa, ur), injects Bootstrap RTL CSS, sets `document.dir`.
- `useTimezone.js` — IANA timezone picker (grouped UTC / Americas / Europe / Africa-ME / Asia / Pacific), stored in localStorage, applied to reminders and calendar.
- `useUnitSystem.js` — metric/imperial preference (auto-detect from `en-US/en-LR/my` → imperial; else metric), localStorage persist.

### `src/layouts/`
- `MainLayout.jsx` — Smart Admin CSS-Grid shell (topbar + sidebar + `<Outlet>` + footer); redirects to `/login` when unauthenticated.
- `AuthLayout.jsx` — login-only wrapper.
- `components/Topbar.jsx` — logo, weather, theme toggle, command-palette trigger, sync/offline badges.
- `components/Sidebar.jsx` + `SidebarMenu.jsx` — Smart Admin menu pattern, `menuData.js` lists routes.

### `src/pages/` (15 pages)
| Route | Component | Purpose |
|---|---|---|
| `/login` | `LoginPage` | Google OAuth + guest-mode entry |
| `/` | `DashboardPage` | FloorplanPanel + PlantListPanel |
| `/today` | `TodayPage` | Today's watering + feeding tasks; snooze, bulk actions |
| `/analytics` | `AnalyticsPage` | ApexCharts: health distribution, watering heatmap, consistency |
| `/calendar` | `CalendarPage` | Monthly care schedule (timezone-aware) |
| `/forecast` | `ForecastPage` | Weather forecast + plant impact (frost / heatwave) |
| `/insights` | `InsightsPage` | ML insights (feature-flagged via `VITE_ML_INSIGHTS_ENABLED`) |
| `/bulk-upload` | `BulkUploadPage` | CSV/Excel import + multi-photo batch create |
| `/propagation` | `PropagationPage` | Propagation tracker, lineage tree, success stats |
| `/scan/:shortCode` | `ScanPage` | QR code landing — deep-links to a plant record |
| `/settings/:tab` | `SettingsPage` | Preferences (location, timezone, unit, temp unit), floors, theme, branding, data export |
| `/settings/billing` | `BillingPage` | Subscription status + Stripe portal |
| `/pricing` | `PricingPage` | Tier options → checkout session |
| `/privacy` | `PrivacyPage` | Public privacy policy |
| `/terms` | `TermsPage` | Public ToS |

### `src/components/` (~42 files, flat)
Grouped by function:
- **Plant CRUD**: `PlantModal.jsx` (large; tabs: Plant / Care / Watering / Fertilise / Journal / Soil / Harvest / Health), `BulkPlantCard.jsx`, `PlantQRTag.jsx`, `SoilTab.jsx`
- **Floorplan**: `Floorplan3D.jsx` (Three.js + R3F), `FloorplanGame.jsx` (playable 3D), `LeafletFloorplan.jsx` (2D), `FloorplanPanel.jsx`, `PlantMarker.jsx`, `PlantIcon.jsx`, `FloorNav.jsx`
- **Panels / lists**: `PlantListPanel.jsx` (virtualised via react-window), `FloorplanPanel.jsx`
- **Care logs**: `FeedRecordModal.jsx`, `WateringSheet.jsx`
- **Weather**: `WeatherSky.jsx`, `HouseWeatherFrame.jsx`, `WeatherStrip.jsx`, `WeatherAlertBanner.jsx`, `SeasonBadge.jsx`
- **AI**: `ImageAnalyser.jsx`
- **Command / help / tours**: `CommandPalette.jsx` (fuzzy search + recent plants), `FeatureTour.jsx` (react-joyride), `HelpDrawer.jsx`, `HelpTooltip.jsx`, `WhatsNewModal.jsx`
- **Design system primitives**: `EmptyState.jsx`, `Skeleton.jsx`, `Toast.jsx`, `ErrorAlert.jsx`, `ErrorBoundary.jsx`, `ChartFrame.jsx` (colorblind-safe wrapper)
- **Import / onboarding / billing**: `CsvImportModal.jsx`, `Onboarding.jsx`, `UpgradePrompt.jsx`, `ConsentBanner.jsx` (GDPR cookie / analytics consent)
- **Network**: `OfflineBanner.jsx`, `OfflineIndicator.jsx`
- Storybook stories: `*.stories.jsx` (EmptyState, ErrorAlert, SeasonBadge, Skeleton)

### `src/utils/`
- `watering.js` — `getWateringStatus(plant, weather, floors)`, `isOutdoor`, `getSeason(lat)`, seasonal/pot/soil multipliers, rain-skip logic, urgency color. **Lives frontend-side — backend stores only raw `lastWatered` + `frequencyDays`.**
- `wateringPattern.js` — consistency metrics
- `feeding.js` — fertiliser schedule: `getFeedingStatus`, `getBaseFeedFrequencyDays`
- `todayTasks.js` — `buildWaterTasks`, `buildFeedTasks`, snooze (localStorage)
- `weatherAlerts.js` — frost / heatwave / extreme-weather warnings
- `plantEmoji.js` — `PLANT_EMOJI_GROUPS`, `getPlantEmoji(name, species)`
- `plantName.js` — derive name from species/filename
- `reorganise.js` — floor/room reordering
- `concurrency.js` — max-3-in-flight throttle
- `offlineQueue.js` — queue water/moisture/fertilise mutations to localStorage, flush on reconnect, throws `OfflineQueuedError`
- `errorMessages.js` — API error → user-friendly string mapping (`toFriendlyError`)
- `format.js` — date/time/duration formatting (timezone + locale aware, via Intl)
- `units.js` — metric ↔ imperial conversions (cm↔in, L↔gal, g↔lb)

### `src/i18n/`
- `index.js` — i18next + react-i18next setup. Language auto-detect: browser → localStorage (`plantTracker_language`) → fallback `en`.
- **8 namespaces**: `common`, `onboarding`, `settings`, `errors`, `dashboard`, `plantModal`, `analytics`, `calendar`.
- **8 languages** under `locales/{lang}/{namespace}.json`: `en` (canonical), `es`, `fr`, `de`, `pt`, `ja`, `ar`. Full coverage: en + es. Others are partial (`common` + `onboarding`) and fall back to `en`.
- `ar` is marked RTL; `useRtl()` handles layout flip.
- Use: `const { t } = useTranslation('dashboard'); t('key')`. Language picker is in Settings → Preferences.

### `src/motion/`
- `tokens.js` — central Framer Motion tokens: `DURATION` (fast 0.12s, normal 0.2s, slow 0.32s), `EASE` (cubic-bezier), `SPRING` (stiffness 300, damping 30), and variants (`fadeIn`, `slideInRight`, `pageEnter`, `scaleUp`, `listItem`). Use these — don't inline magic numbers.

### `src/charts/`
- `theme.js` — ApexCharts global theme (light/dark colors, font, legend, tooltip). Imported by `ChartFrame.jsx` which is the canonical wrapper — charts should go through it for consistent styling, colourblind-safe palettes, and dark-mode responsiveness.

### `src/data/`
- `guestData.js` — demo plants + floors for unauthenticated / guest mode
- `defaultFloorSvgs.js` — SVG room templates
- `changelog.json` — version history shown by `WhatsNewModal.jsx`

### `src/help/`
- `articles.js` — ~8 help articles (adding plants, health grades, watering logic, floorplan AI, analytics, temp units, privacy, ML insights). Rendered by `HelpDrawer.jsx`.

### `src/stories/`
- `Primitives.stories.jsx`, `Tokens.stories.jsx` — design-system reference surfaces for Storybook.

### `src/__tests__/`
Vitest + React Testing Library + jsdom. Setup: `src/__tests__/setup.js`. Coverage thresholds: lines 35, functions 30, branches 35. Canvas/WebGL-heavy components (`Floorplan3D`, `FloorplanGame`) excluded from coverage. `SubscriptionProvider` is typically mocked at module level when a component renders `<UpgradePrompt>` (which calls `useSubscription` and will throw unless wrapped).

## Backend (`api/plants/`)

All HTTP handlers in **`index.js`** (~4000 lines). Supporting modules: `billing.js`, `tierGate.js`, `vertexai.js`. Tests: `index.test.js`, `billing.test.js`, `tierGate.test.js`, `upload.test.js`, `vertexai.test.js`. Integration tests in `integration/` use a Firestore emulator (`docker-compose.emulator.yml`).

### HTTP routes

**Health / status** (no auth)
- `GET /health`
- `GET /ml/status`
- `GET /ml/export` (requireUser) — full user-data export

**AI analysis** (Gemini 2.5 Flash, structured output)
- `POST /analyse` (softAuth, checkQuota ai_analyses)
- `POST /analyse-with-hint` (softAuth, checkQuota ai_analyses)
- `POST /analyse-floorplan` (no auth) — image → floors[].rooms[]
- `POST /recommend` (no auth) — species → care guide
- `POST /recommend-watering` (no auth)
- `POST /recommend-fertiliser` (no auth)
- `POST /recommend-propagation` (no auth)
- `POST /plants/:id/diagnostic` (requireUser, checkQuota ai_analyses) — pest/disease from photo

**Plant CRUD** (requireUser)
- `GET /plants` — cursor-paginated (`PAGE_SIZE=50`, returns `nextCursor`)
- `POST /plants` (checkQuota plants)
- `GET /plants/:id`, `PUT /plants/:id`, `DELETE /plants/:id`
- `GET /plants/:id/short-code` — returns QR short slug
- `GET /scan/:shortCode` — resolve slug → plant (used by `/scan/:shortCode` frontend page)

**Plant care logs** (requireUser)
- `POST /plants/:id/water`, `GET /plants/:id/waterings` (paginated)
- `POST /plants/:id/moisture`
- `POST /plants/:id/fertilise`
- `GET / POST /plants/:id/measurements`, `DELETE /plants/:id/measurements/:measurementId`
- `GET / POST /plants/:id/phenology`, `DELETE /plants/:id/phenology/:eventId`
- `GET / POST / PUT / DELETE /plants/:id/journal[/:entryId]`
- `GET / POST / DELETE /plants/:id/harvests[/:harvestId]`

**Soil health (#304)** (requireUser)
- `GET / POST / DELETE /plants/:id/soil-tests[/:testId]` — pH, EC, NPK, organic matter %, texture, source (strip/probe/lab/visual)
- `GET / POST / DELETE /plants/:id/amendments[/:amendmentId]` — kind (compost/lime/sulphur/gypsum/biochar/fertiliser/other), qty, unit
- `GET / POST /plants/:id/substrate-changes`
- `GET /plants/:id/soil-insight` — rule-based pH verdict (low/ideal/high) + Gemini one-sentence rationale

**Pest / disease** (requireUser)
- `GET / POST /plants/:id/incidents`, `PUT /plants/:id/incidents/:id`, `DELETE /plants/:id/incidents/:id`
- `POST /plants/:id/incidents/:id/treatments`, `POST /plants/:id/incidents/:id/resolve`
- `GET /outbreaks` — cross-plant outbreak aggregation, `POST /outbreaks/:id/treat`, `POST /outbreaks/:id/resolve`

**Propagation** (requireUser)
- `GET / POST /propagations`, `PUT /propagations/:id`, `DELETE /propagations/:id`
- `POST /propagations/:id/promote` — convert to independent plant
- `GET /propagation/stats` — success rate by species/method/month + top mothers (90-day survival rule)
- `GET /plants/:id/lineage` — ancestors + descendants (depth ≤ 3, cycle-guarded)

**Plant analytics / ML** (requireUser; some tier-gated)
- `GET /plants/:id/watering-pattern`, `GET /plants/:id/watering-recommendation`
- `GET /plants/:id/health-prediction` *(requireTier home_pro)*
- `GET /plants/:id/seasonal-adjustment`, `GET /plants/:id/care-score`, `GET /plants/:id/anomaly`
- `POST /plants/recalculate-frequencies`
- `GET /ml/care-scores` *(requireTier home_pro)*
- `GET /species/:name/cluster`
- `POST /ml/anomaly-scan` (no auth — background scan)

**Config** (requireUser)
- `GET / PUT /config/floors`
- `GET / PUT /config/floorplan`
- `GET / PUT /config/branding` *(requireTier landscaper_pro)* — white-label logo, colors, business info

**Images** (requireUser)
- `POST /images/upload-url` → signed GCS upload URL; frontend PUTs directly
- `DELETE /plants/:id/photos` — remove by URL

**Data export / import** (requireUser, home_pro+)
- `GET /export/plants`, `GET /export/watering-history`, `GET /export/care-schedule`
- `GET /import/plants/template`, `POST /import/plants` — CSV/XLSX upload

**Public REST API** — `home_pro+`, keys via header `x-plant-api-key`, separate `publicApiLimiter`
- `POST / GET / DELETE /api-keys[/:id]` — manage keys (list returns hash)
- `GET /api/v1/plants`, `GET /api/v1/plants/:id`, `POST /api/v1/plants/:id/water`
- `GET /api/v1/plants/:id/care-score` *(requireTier home_pro)*

**Billing (Stripe)**
- `POST /billing/webhook` — raw body, signature verified, idempotent via `stripeEvents/{event.id}` (no auth)
- `POST /billing/create-checkout-session` (requireUser)
- `POST /billing/create-portal-session` (requireUser)
- `GET /billing/subscription` (requireUser)

**Account** (requireUser)
- `DELETE /account` — full GDPR delete
- `GET /account/export` — GDPR data export

### Backend env vars
- `GEMINI_API_KEY` — Gemini API key
- `IMAGES_BUCKET` — GCS bucket for plant photos
- `SERVICE_ACCOUNT_EMAIL` — GCP SA for signing Cloud Storage URLs
- `BILLING_ENABLED` — `'true'` to activate tier/quota enforcement; anything else makes `requireTier` and `checkQuota` no-ops (dark-ship switch)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_*_MONTHLY`, `STRIPE_PRICE_*_ANNUAL` — per-tier price IDs

Injected by Terraform / Cloud Run. Not needed for unit tests (mocked).

### Backend conventions & gotchas
- **Signed URLs** — every endpoint returning plant data MUST call `signPlantData()` before responding. 1-hour TTL. `photoLog` deduped by normalised URL path (strip query). Missing signing = broken images. (Memory: `feedback_sign_plant_data`.)
- **Gemini response sanitisation** — Gemini occasionally emits raw control chars (U+0000–U+001F) inside JSON. `parseGeminiJson()` strips markdown fences, extracts embedded JSON, escapes control chars (named + two-layer defense on fetch and parse), then falls back to `jsonrepair`. Truncation detection: `finishReason === 'MAX_TOKENS'` returns a friendly error.
- **Gemini retry** — up to 2 retries with 1s/2s backoff on 429/503/`UNAVAILABLE (14)`/`RESOURCE_EXHAUSTED (8)`. Errors surfaced to UI are friendly; don't leak rate-limit internals.
- **Rate limiting** — 200 req / 15 min per IP globally. Public API has a separate limiter.
- **CORS allow-list** — `https://plants.lopezcloud.dev`, `http://localhost:5173`. Methods GET/POST/PUT/DELETE/OPTIONS. Headers: `Content-Type`, `x-api-key`, `Authorization`, `x-plant-api-key`.
- **Stripe webhook idempotency** — event IDs recorded in Firestore to prevent double-processing.
- **Outdoor room heuristic** — rooms named Garden/Balcony/Outdoors/Patio/Terrace/Veranda/Deck/Courtyard are treated as outdoor. `plantedIn` and floor `type` override.
- **API-key storage** — plaintext key is returned once at creation; only SHA-256 hash is persisted.

## Data model (Firestore)

### Plant — `users/{userId}/plants/{plantId}`
Identity: `id`, `name`, `species`, `floor`, `room`, `x`/`y` (percentage 0–100).
Attributes: `health` (Excellent/Good/Fair/Poor), `maturity`, `plantedIn` (pot/garden-bed/ground), `potSize`, `potMaterial`, `soilType`, `sunExposure`, `notes`, `emoji`.
Watering: `frequencyDays`, `lastWatered`, `wateringLog[]`, `lastMoistureReading` (0–5), `lastMoistureDate`, `moistureLog[]`.
Fertiliser: `fertiliser: { frequencyDays, lastFed, type, strength, dilution }`, `feedingLog[]`.
Health / photos: `healthLog[]`, `imageUrl`, `photoLog[]` (signed, deduped), `lastDiagnostic`.
Cached AI: `recommendations` + `recommendationUpdatedAt`, `wateringRecommendation` + `*UpdatedAt`.
Care score cache: `careScore` (0–100), `careLetter` (A–F).
Propagation lineage: `parentPlantId`, `parentPropagationId` (when promoted).
QR: `shortCode`, `qrImageUrl`.
Import: `importBatchId`, `csvRowIndex` (when created via bulk import).

Sub-collections (all under a plant doc): `soilTests`, `amendments`, `substrateChanges`, `measurements`, `phenology`, `journal`, `harvests`, `incidents`, `treatments`, `waterings` (legacy/normalised).

`plantedIn` controls conditional display of `potSize` / `soilType` / `potMaterial` fields in PlantModal.

### Floor — `users/{userId}/config/floors/{floorId}`
`id`, `name`, `order` (0 = ground, -1 = outdoor, 1+ = upper), `type` (interior/outdoor), `imageUrl` (signed), `rooms[] = { id, name, x, y, width, height, type, area }`.

### Propagation — `users/{userId}/propagations/{id}`
`parentPlantId`, `species`, `method` (cutting/seed/division/layering), `status` (sown/rooted/transplanted/failed), `startDate`, `stage`, `potSize`, `soilType`, `notes`, `photoLog`, `promotedAt`, `promotedToPlantId`.

### Config — `users/{userId}/config/*`
- `floors` — array-of-floors document
- `floorplan` — JSON layout
- `branding` — (landscaper_pro only) `businessName`, `primaryColor` (hex), `logoUrl` (signed), contact info

### Subscription — `users/{userId}/subscription/current`
`tier`, `status` (active/trialing/past_due/cancelled), `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `stripeCustomerId`, `stripeSubscriptionId`, `usage: { plants, ai_analyses, photo_storage_mb }`.

### API keys — `users/{userId}/apiKeys/{id}` + `apiKeyHashes/{hash}` (top-level lookup)
Hash-only storage; plaintext key displayed once on creation.

## Billing & tier gating

`api/plants/billing.js` — `TIERS`:
| Tier | Level | Plants | AI analyses/mo | Photos | Properties | Team |
|---|---|---|---|---|---|---|
| `free` | 0 | 10 | 5 | 50 MB | 1 | 0 |
| `home_pro` | 1 | ∞ | ∞ | 2 GB | 1 | 0 |
| `landscaper_pro` | 2 | ∞ | ∞ | 10 GB | ∞ | 10 |

`getCurrentTier(db, userId)` resolves from Firestore subscription doc. Past-due within a 7-day grace still returns stored tier; after that → `free`. `BILLING_ENABLED !== 'true'` short-circuits everything to free and no-ops the middlewares — **this is the dark-ship switch**.

`tierGate.js` exports `createTierGate(db)` → `{ requireTier, checkQuota }`.
- `requireTier(minTier)` returns 403 `{ error: 'upgrade_required', requiredTier, currentTier, upgradeUrl: '/pricing' }`
- `checkQuota(quotaType, counter)` returns 429 `{ error: 'quota_exceeded', quotaType, limit, current }`

Gated endpoints (summary):
- **home_pro**: `/plants/:id/health-prediction`, `/ml/care-scores`, `/export/*`, `/import/*`, `/api-keys*`, `/api/v1/plants/:id/care-score`
- **landscaper_pro**: `/config/branding`
- **Quotas**: `plants` on `POST /plants`; `ai_analyses` on `POST /analyse`, `POST /analyse-with-hint`, `POST /plants/:id/diagnostic`

Frontend: `SubscriptionContext` exposes `canAccess(minTier)`, `getQuotaRemaining(type)`, `isAtQuotaLimit(type)`. `<UpgradePrompt id quota|feature>` renders an inline upsell when the user hits a wall (returns null if `!billingEnabled`).

## Styling & design system

- **Framework**: Bootstrap 5.3 + React-Bootstrap + Smart Admin SCSS (entry `src/assets/sass/smartapp.scss`).
- **Themes**: 9 colour themes (`olive` default + earth/aurora/lunar/nebula/night/solar/storm/flare). Switch via `LayoutContext.changeThemeStyle()`; dark mode via `changeTheme('dark')`.
- **Panels**: Smart Admin `panel / panel-hdr / panel-container / panel-content`.
- **Icons**: Smart Admin SVG sprite — `<svg className="sa-icon"><use href="/icons/sprite.svg#icon-name"></use></svg>` (sizes `sa-icon-2x`, `sa-icon-5x`).
- **Charts**: ApexCharts via `react-apexcharts`, wrapped by `ChartFrame.jsx` using theme from `src/charts/theme.js` (colourblind-safe, dark-aware).
- **Motion**: Framer Motion tokens in `src/motion/tokens.js` — `transition={{ duration: DURATION.normal, ease: EASE.out }}` or use exported variants.
- **Typography**: defined in `src/assets/sass/app/_typography.scss`; see `DESIGN.md` for token reference.
- **RTL**: `useRtl()` injects Bootstrap RTL CSS for `ar`/`he`/`fa`/`ur` and sets `document.dir`. Custom RTL overrides in `_rtl.scss`.

## Storybook

`.storybook/main.js` — React-Vite framework. Stories: `src/stories/**/*.stories.js(x)` + `src/components/**/*.stories.js(x)`. VitePWA is filtered out (doesn't work in the iframe). Sass deprecation warnings silenced (Bootstrap import syntax). Build: `npm run build-storybook` → `storybook-static/`.

## Offline / PWA

`vite-plugin-pwa` in `vite.config.js`, `autoUpdate` register. Workbox runtime caching: images 30d (CacheFirst, max 200), fonts 1y (CacheFirst, max 20), `/plants` StaleWhileRevalidate (200 only), `/config/(floorplan|floors)` StaleWhileRevalidate. Fallback `/index.html`; deny list `/^\/api/`.

Offline queue (`src/utils/offlineQueue.js`): queues water / moisture / fertilise mutations to localStorage when offline, flushes on reconnect, throws `OfflineQueuedError` so UI can show a "queued" toast. `OfflineBanner` shows pending count; `OfflineIndicator` lives in the topbar.

## Environment variables (frontend)

`.env.local` (copy from `.env.example`):
```
VITE_GOOGLE_CLIENT_ID=           # OAuth 2.0 Web client ID
VITE_API_BASE_URL=               # API Gateway URL
VITE_API_KEY=                    # x-api-key for API Gateway
VITE_ML_INSIGHTS_ENABLED=        # 'true' to show /insights
```

Build-time globals injected by `vite.config.js`: commit SHA, build timestamp.

## Tests

- **Frontend**: Vitest + React Testing Library + jsdom. Thresholds: lines 35, functions 30, branches 35. Excludes `Floorplan3D`, `FloorplanGame`, `guestFloorSvgs.js`. Mock `SubscriptionContext` when rendering components that use `<UpgradePrompt>`.
- **Backend unit**: Vitest + proxyquire + in-memory Firestore mock (pattern in `index.test.js`). Tight thresholds — new endpoints must have tests.
- **Backend integration**: `api/plants/integration/` against Firestore emulator (`docker-compose.emulator.yml`).
- **E2E**: Playwright `e2e/smoke.spec.js`; `E2E_BASE_URL` env; 60s timeout, 1 retry, screenshot on failure.

## CI/CD (`.github/workflows/deploy.yml`)

Triggers: push `main`, PR `main`, manual `workflow_dispatch`.

1. **changes** — dorny/paths-filter detects `api/plants/**` changes.
2. **test** — Node 20, `npm install --legacy-peer-deps` (both), `npm audit --audit-level=high`, lint backend, Vitest (backend + frontend) with coverage, Codecov upload, artefact upload (7-day retention).
3. **deploy-function** (push + backend changed) — WIF auth → zip `api/plants/` (exclude node_modules/tests/configs) → upload to GCS source bucket → trigger `platform-infra` Terraform apply workflow with the object name.
4. **verify-function** (push) — poll `platform-infra` apply (15 × 15s), then hit `/health` 5 × 10s to confirm new revision live.
5. **build-and-deploy** (push) — Vite build with `VITE_*` secrets → GCP auth → `firebase deploy --only hosting` to `home-plant-tracker-lcd`.

`codeql.yml` runs security-extended CodeQL on push/PR + weekly Monday 08:00 UTC.

> After pushing, always watch Actions until both deploy jobs succeed. The function deploy passes through `platform-infra` and can silently no-op if the zip hash matches — confirm via `/health`. (Memory: `project_cloud_function_deploy`.)

## Key conventions & gotchas (quick scan)

- **Firestore paths**: `users/{userId}/plants/{plantId}`, `users/{userId}/config/*`, `users/{userId}/subscription/current`, `users/{userId}/propagations/{id}`, `users/{userId}/apiKeys/{id}`. Backend NEVER reads/writes outside `users/{userId}/` (except global lookups like `apiKeyHashes` and `stripeEvents`).
- **Plant position** — percentage coords (0–100); `getRoomAtPosition()` resolves room by bounding box.
- **Watering logic** — frontend-only in `src/utils/watering.js`. Backend stores raw `lastWatered` + `frequencyDays`; UI applies seasonal (spring 1.0x, summer 1.3x, autumn 0.85x, winter 0.7x — hemisphere auto-flipped by latitude), pot, soil, weather, and plantedIn multipliers.
- **Rain auto-water skip** — outdoor plants auto-record a `method: rain` entry on rainy days; deduped by date + method. Indoor plants untouched.
- **Image upload flow** — frontend asks backend for signed GCS upload URL → direct PUT to GCS → backend returns public storage.googleapis.com URL. No API-key header on the GCS PUT.
- **Cursor pagination** — `GET /plants` returns `{ items, nextCursor }`. Frontend state: `plantsNextCursor`, `plantsLoadingMore`.
- **Stripe dark-ship** — `BILLING_ENABLED` env flag; when off, tier/quota middleware is no-op and all users see `free` shape. UI `UpgradePrompt` also returns null.
- **i18n namespace pattern** — `useTranslation('dashboard'); t('key')`. Not all languages have all namespaces — missing keys fall back to `en`.
- **Timezone & unit system** — reminders, "X days overdue" badges, and calendar all pass through `useTimezone` + `useUnitSystem`. When reading / writing dates cross-boundary, default to ISO strings in UTC and convert for display.
- **Motion tokens** — don't inline durations/easings; import from `src/motion/tokens.js` so changes are global.
- **Stay scoped** — only change the project being worked on; do not cross into `platform-infra` from here. Flag a plan instead (user runs a separate session there). (Memory: `feedback_platform_infra_plans`.)
- **No local tests by default** — GitHub Actions is the source of truth. Run `npm run build` + `npm audit` locally before pushing. For Dependabot major / pre-1.0 minor bumps, `gh pr checkout` and attempt a build locally (memory: `feedback_test_major_bumps`).
- **Close issues when done**; **push after work** (memory).
- **Debug data first** — one curl against the API Gateway usually reveals more than reading code. CORS errors almost always mask a real 4xx/5xx — curl directly bypasses the browser CORS layer. (Memory: `feedback_cors_debugging`.)
- **Don't touch storybook-static/ by hand** — it's a build artefact that's checked in so Firebase can serve it; regenerate via `npm run build-storybook`.

## External repo references

- **`platform-infra`** — Terraform for all GCP resources (Cloud Run, API Gateway OpenAPI spec, Firestore, GCS, Secret Manager, IAM, WIF). New backend routes must have a matching OpenAPI entry there.
- **Codecov** — coverage reports uploaded in CI (non-blocking at 30% threshold).
- **GitHub Issues** — feature tracking; close issues when implementing their fix.
