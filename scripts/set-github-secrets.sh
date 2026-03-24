#!/usr/bin/env bash
set -euo pipefail

REPO="lopeztech/home-plant-tracker"
TERRAFORM_DIR="$(cd "$(dirname "$0")/../terraform" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Reading Terraform outputs from: $TERRAFORM_DIR"
cd "$TERRAFORM_DIR"

# ── Read outputs from Terraform ───────────────────────────────────────────────

GCP_WORKLOAD_IDENTITY_PROVIDER=$(terraform output -raw workload_identity_provider)
GCP_SERVICE_ACCOUNT=$(terraform output -raw service_account_email)
GCS_BUCKET_NAME=$(terraform output -raw bucket_name)
ARTIFACT_REGISTRY_REPO=$(terraform output -raw artifact_registry_repo)
LOAD_BALANCER_IP=$(terraform output -raw load_balancer_ip)

# ── Prompt for OAuth Client ID (created manually in Cloud Console) ────────────

echo ""
echo "Paste your Google OAuth 2.0 Client ID (from Cloud Console → APIs & Services → Credentials):"
read -r VITE_GOOGLE_CLIENT_ID
if [[ -z "$VITE_GOOGLE_CLIENT_ID" ]]; then
  echo "Error: OAuth Client ID cannot be empty." >&2
  exit 1
fi

# ── Hardcoded values ──────────────────────────────────────────────────────────

ARTIFACT_REGISTRY_REGION="australia-southeast1"
CLOUD_RUN_REGION="australia-southeast1"
GCP_PROJECT_ID="home-plant-tracker-491202"

# ── Set GitHub Secrets ────────────────────────────────────────────────────────

echo ""
echo "Setting GitHub Secrets on $REPO..."

gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "$GCP_WORKLOAD_IDENTITY_PROVIDER" --repo "$REPO"
echo "  ✓ GCP_WORKLOAD_IDENTITY_PROVIDER"

gh secret set GCP_SERVICE_ACCOUNT --body "$GCP_SERVICE_ACCOUNT" --repo "$REPO"
echo "  ✓ GCP_SERVICE_ACCOUNT"

gh secret set GCS_BUCKET_NAME --body "$GCS_BUCKET_NAME" --repo "$REPO"
echo "  ✓ GCS_BUCKET_NAME"

gh secret set ARTIFACT_REGISTRY_REPO --body "$ARTIFACT_REGISTRY_REPO" --repo "$REPO"
echo "  ✓ ARTIFACT_REGISTRY_REPO"

gh secret set ARTIFACT_REGISTRY_REGION --body "$ARTIFACT_REGISTRY_REGION" --repo "$REPO"
echo "  ✓ ARTIFACT_REGISTRY_REGION"

gh secret set CLOUD_RUN_REGION --body "$CLOUD_RUN_REGION" --repo "$REPO"
echo "  ✓ CLOUD_RUN_REGION"

gh secret set GCP_PROJECT_ID --body "$GCP_PROJECT_ID" --repo "$REPO"
echo "  ✓ GCP_PROJECT_ID"

gh secret set VITE_GOOGLE_CLIENT_ID --body "$VITE_GOOGLE_CLIENT_ID" --repo "$REPO"
echo "  ✓ VITE_GOOGLE_CLIENT_ID"

# ── Write .env.local for local development ────────────────────────────────────

ENV_FILE="$PROJECT_ROOT/.env.local"
echo "VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID" > "$ENV_FILE"
echo ""
echo "  ✓ Written $ENV_FILE for local development"

# ── Print DNS instruction ─────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DNS — add this A record at your DNS provider:"
echo ""
echo "    Type : A"
echo "    Name : plants"
echo "    Value: $LOAD_BALANCER_IP"
echo ""
echo "  Full domain: plants.lopezcloud.dev → $LOAD_BALANCER_IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Done. Push to main to trigger the first deployment."
