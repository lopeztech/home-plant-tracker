# Home Plant Tracker

Track your houseplants on an interactive floorplan — know which ones need watering, where they live, and get AI-powered care advice.

**Live app:** https://plants.lopezcloud.dev

---

## What it does

- **Interactive floorplan** — click or tap any spot on your home's floor plan to place a plant marker; drag markers to reposition them
- **Watering tracker** — each plant shows how many days until it needs watering; overdue plants are flagged immediately
- **AI plant analysis** — upload a photo and Gemini identifies the species, assesses health, and recommends a watering frequency
- **AI floorplan analysis** — upload a photo of your floor plan and Gemini automatically generates your home's layout with labelled rooms across multiple floors
- **Care recommendations** — per-plant AI care guidance covering watering, light, soil, humidity, temperature, and common issues
- **Weather integration** — live weather and a 3-day forecast; outdoor plants get a skip-watering alert when rain is forecast
- **Multi-floor support** — manage plants across ground floor, upper floors, and garden separately
- **Google sign-in** — each user's plants are private and stored in their own Firestore namespace

---

## Architecture

```
Browser (React SPA)
    │  Google OAuth (ID token)
    │  x-api-key header
    ▼
Cloud Load Balancer + CDN  ──  Cloud Storage (static assets)
    │
    ▼
GCP API Gateway  (OpenAPI 2.0, JWT validation, API key auth)
    │
    ▼
Cloud Run Function  (Node 20, Express, functions-framework)
    ├── Firestore  (per-user plant + floor config)
    ├── Cloud Storage  (plant photos — signed upload/read URLs)
    └── Gemini API  (plant analysis, floorplan analysis, care recommendations)
```

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Lucide icons |
| Auth | Google OAuth 2.0 (`@react-oauth/google`), verified by API Gateway |
| API gateway | GCP API Gateway (OpenAPI 2.0 spec) |
| Backend | Node 20, Express, Cloud Run Functions (gen 2) |
| Database | Cloud Firestore (native mode) |
| File storage | Cloud Storage with signed URLs |
| AI | Google Gemini (`@google/generative-ai`) |
| Hosting | Cloud Run (nginx), Global Load Balancer, Cloud CDN |
| Infrastructure | Terraform ≥ 1.5, Google provider ~> 5.0 |
| CI/CD | GitHub Actions — deploy on push to `main` |

---

## Prerequisites

- **Node.js 20+** and npm
- **Google Cloud SDK** (`gcloud`) — [install guide](https://cloud.google.com/sdk/docs/install)
- **Terraform ≥ 1.5** — [install guide](https://developer.hashicorp.com/terraform/install)
- A **GCP project** with billing enabled
- A **Google OAuth 2.0 client ID** (Web application type) for sign-in
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Local development

The frontend talks directly to the deployed API Gateway, so you only need to run Vite locally.

**1. Clone and install dependencies**

```bash
git clone https://github.com/lopeztech/home-plant-tracker.git
cd home-plant-tracker
npm install
```

**2. Create `.env.local`**

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>.apps.googleusercontent.com
VITE_API_BASE_URL=https://<your-gateway-hostname>.ts.gateway.dev
VITE_API_KEY=<your-api-gateway-key>
```

See [Environment variables](#environment-variables) for details on each value.

**3. Start the dev server**

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

**Running tests**

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:ui       # Vitest UI in browser
```

---

## Infrastructure

All cloud resources are managed with Terraform under the `terraform/` directory.

### First-time setup

**1. Enable required APIs manually** (one-time, before Terraform can run)

```bash
gcloud services enable cloudresourcemanager.googleapis.com --project=<PROJECT_ID>
```

**2. Create a `terraform.tfvars` file**

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
```

Fill in your values:

```hcl
project_id              = "your-gcp-project-id"
region                  = "australia-southeast1"   # or your preferred region
domain                  = "plants.yourdomain.com"
environment             = "prod"
github_org              = "your-github-username"
github_repo             = "home-plant-tracker"
terraform_operator_email = "you@example.com"
gemini_api_key          = "your-gemini-api-key"
iap_allowed_users       = ["user:you@gmail.com"]
```

**3. Apply**

```bash
cd terraform
terraform init
terraform apply
```

Terraform provisions: Cloud Run service, Cloud Run Function, API Gateway, Firestore database, Cloud Storage buckets, Load Balancer + CDN, SSL certificate, IAM roles, and Workload Identity Federation for GitHub Actions.

**4. Point DNS**

After apply, note the load balancer IP from the outputs:

```bash
terraform output app_ip
```

Create a DNS `A` record for your domain pointing to that IP. The managed SSL certificate provisions automatically once DNS propagates.

### Subsequent changes

```bash
cd terraform
terraform plan
terraform apply
```

---

## Deploying

CI/CD is handled by GitHub Actions (`.github/workflows/deploy.yml`). Every push to `main`:

1. Authenticates to GCP via **Workload Identity Federation** (no long-lived service account keys)
2. Builds the Docker image with the Vite env vars baked in
3. Pushes the image to **Artifact Registry**
4. Deploys the image to **Cloud Run**
5. Invalidates the **Cloud CDN** cache

### Required GitHub secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Full WIF provider resource name from Terraform output |
| `GCP_SERVICE_ACCOUNT` | Deployer service account email from Terraform output |
| `ARTIFACT_REGISTRY_REGION` | Region of your Artifact Registry repository |
| `ARTIFACT_REGISTRY_REPO` | Full Artifact Registry repository path |
| `GCP_PROJECT_ID` | Your GCP project ID |
| `CLOUD_RUN_REGION` | Region where the Cloud Run service is deployed |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (baked into the frontend build) |
| `VITE_API_BASE_URL` | API Gateway base URL (baked into the frontend build) |
| `VITE_API_KEY` | API Gateway key (baked into the frontend build) |

The WIF provider and service account values are available as Terraform outputs after the first `terraform apply`:

```bash
terraform output github_wif_provider
terraform output github_deployer_sa
```

### Manual deploy (backend only)

To redeploy the Cloud Run Function without a full CI run:

```bash
gcloud functions deploy plant-tracker-plants-api \
  --gen2 \
  --runtime=nodejs20 \
  --region=australia-southeast1 \
  --source=api/plants \
  --entry-point=plantsApi \
  --trigger-http \
  --no-allow-unauthenticated
```

---

## Environment variables

| Variable | Where used | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Frontend build | Google OAuth 2.0 client ID. Create a **Web application** OAuth client in the GCP Console under APIs & Services → Credentials. Add `http://localhost:5173` as an authorised JavaScript origin for local dev. |
| `VITE_API_BASE_URL` | Frontend build | Base URL of the API Gateway (e.g. `https://my-gateway.ts.gateway.dev`). Available from `terraform output api_gateway_url` after deploy. |
| `VITE_API_KEY` | Frontend build | API key sent as the `x-api-key` request header. Create an API key in GCP Console → APIs & Services → Credentials, restricted to the API Gateway service. |

---

## Project structure

```
home-plant-tracker/
├── src/                      # React frontend
│   ├── components/           # UI components (PlantSidebar, PlantModal, FloorplanView, …)
│   ├── contexts/             # AuthContext (Google OAuth state)
│   ├── hooks/                # useWeather (geolocation + Open-Meteo)
│   ├── api/                  # API client (plantsApi, floorsApi, analyseApi, …)
│   ├── data/                 # Default floor plan SVGs
│   └── pages/                # LoginPage
├── api/
│   └── plants/               # Cloud Run Function (Express)
│       └── index.js          # All API routes
├── terraform/                # Infrastructure as code
├── .github/workflows/        # CI/CD (deploy.yml)
├── Dockerfile                # Multi-stage: Node build → nginx
├── nginx.conf                # SPA routing + asset caching
└── api/openapi.yaml          # API Gateway OpenAPI 2.0 spec
```

## 💰 Bounty Contribution

- **Task:** Monetisation: Gift subscriptions & shareable Plant Tracker gift cards
- **Reward:** $60
- **Source:** GitHub-Paid
- **Date:** 2026-04-27

