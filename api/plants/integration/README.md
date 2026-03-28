# Integration Tests

These tests run against the **live deployed API** using real HTTP calls — no mocks.

## Setup

### 1. Set environment variables

```bash
export INTEGRATION_API_URL="https://your-gateway-id.uc.gateway.dev"
export INTEGRATION_API_KEY="your-api-gateway-key"
export INTEGRATION_AUTH_TOKEN="$(gcloud auth print-identity-token)"
```

The auth token expires after 1 hour. Re-run `gcloud auth print-identity-token` if tests start failing with 401.

### 2. Add sample images (optional but recommended)

Drop real images into `api/plants/integration/images/`:

| File | Used by |
|------|---------|
| `plant.jpg` | `POST /analyse` — tests Gemini plant identification |
| `floorplan.jpg` | `POST /analyse-floorplan` — tests Gemini floor plan parsing |

Tests that need these images are automatically skipped if the files are not present. The `images/` folder is git-ignored.

### 3. Run the tests

From the repo root:
```bash
npm run test:integration --workspace=api/plants
```

Or from `api/plants/`:
```bash
npm run test:integration
```

## What is tested

| Suite | Auth needed | Image needed |
|-------|-------------|--------------|
| Configuration diagnostics | — | — |
| `GET /health` | no | — |
| Authentication (401/200) | both | — |
| Plants CRUD (create/list/get/update/water/delete) | yes | — |
| `POST /images/upload-url` (+ real GCS PUT) | yes | `plant.jpg` for GCS PUT |
| `POST /analyse` (Gemini) | yes | `plant.jpg` |
| `POST /analyse-floorplan` (Gemini) | yes | `floorplan.jpg` |
| `POST /recommend` (Gemini) | yes | — |
| Config floors (GET + PUT, auto-restored) | yes | — |

## Notes

- Plants created during the test run are named `[integration-test] …` and are deleted in `afterAll`.
- The floors config is snapshotted before the test run and restored afterwards.
- Gemini tests have a 120-second timeout — they are slow by design.
