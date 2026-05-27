# Home Plant Tracker — Product Spec

> **Onboarding skeleton** seeded for agent-forge. This `spec/` is the source of
> truth the BA reads to hydrate and de-duplicate the backlog. Spec edits come
> **only from human PRs** — expand and correct these files over time.

## Mission

Help people care for their houseplants: place plants on an interactive floorplan
of their home, track when each needs watering, and get AI-powered identification
and care advice.

Live app: https://plants.lopezcloud.dev

## Core capabilities

- **Interactive floorplan** — place and drag plant markers on a home floor plan;
  multi-floor support (ground floor, upper floors, garden) managed separately.
- **Watering tracker** — days-until-watering per plant; overdue plants flagged;
  outdoor plants get a skip-watering alert when rain is forecast.
- **AI plant analysis (Gemini)** — identify the species from a photo, assess
  health, and recommend a watering frequency.
- **AI floorplan analysis (Gemini)** — generate a labelled multi-floor layout
  from a photo of a floor plan.
- **Care recommendations** — per-plant guidance: watering, light, soil, humidity,
  temperature, and common issues.
- **Weather integration** — live weather plus a 3-day forecast.
- **Accounts** — Google sign-in; each user's plants are private, stored in a
  per-user Firestore namespace.

## Architecture (summary)

- **Frontend** — React 18 + Vite single-page app (`src/`); Storybook design
  system (see `DESIGN.md`).
- **Backend** — Node 20 / Express on Cloud Run Functions (`api/`), fronted by GCP
  API Gateway (OpenAPI 2.0, Google-OAuth JWT + API-key auth).
- **Data** — Cloud Firestore (per-user plant + floor config); Cloud Storage for
  plant photos via signed URLs.
- **AI** — Google Gemini (`@google/generative-ai`).
- **Testing** — Vitest unit/component tests; Playwright end-to-end (`e2e/`).

See the repo `README.md` for setup and `DESIGN.md` for the design-system tokens
and Storybook catalogue.
