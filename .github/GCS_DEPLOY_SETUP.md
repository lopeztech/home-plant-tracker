# GCS Deployment Setup

## Prerequisites
- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated

## 1. Create a GCS Bucket

```bash
export PROJECT_ID=your-project-id
export BUCKET_NAME=your-bucket-name   # must be globally unique
export REGION=us-central1             # or your preferred region

gcloud storage buckets create gs://$BUCKET_NAME \
  --project=$PROJECT_ID \
  --location=$REGION \
  --uniform-bucket-level-access

# Enable public access
gcloud storage buckets update gs://$BUCKET_NAME --no-public-access-prevention
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member=allUsers \
  --role=roles/storage.objectViewer

# Configure as static website
gcloud storage buckets update gs://$BUCKET_NAME \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html
```

## 2. Create a Service Account

```bash
export SA_NAME=plant-tracker-deployer

gcloud iam service-accounts create $SA_NAME \
  --project=$PROJECT_ID \
  --display-name="Plant Tracker GitHub Actions Deployer"

# Grant only the permissions needed to write to the bucket
gcloud storage buckets add-iam-policy-binding gs://$BUCKET_NAME \
  --member="serviceAccount:$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --role=roles/storage.objectAdmin
```

## 3. Set Up Workload Identity Federation (keyless auth — recommended)

```bash
export GITHUB_ORG=your-github-username-or-org
export GITHUB_REPO=home-plant-tracker

# Create Workload Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --project=$PROJECT_ID \
  --location=global \
  --display-name="GitHub Actions Pool"

# Create OIDC Provider for GitHub
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow the specific repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com" \
  --project=$PROJECT_ID \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/$GITHUB_ORG/$GITHUB_REPO"

# Get the provider resource name (you'll need this for the secret)
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT_ID \
  --location=global \
  --workload-identity-pool=github-pool \
  --format='value(name)'
```

## 4. Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** and add:

| Secret | Value |
|--------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output of the last `gcloud` command above (e.g. `projects/123456/locations/global/workloadIdentityPools/github-pool/providers/github-provider`) |
| `GCP_SERVICE_ACCOUNT` | `plant-tracker-deployer@your-project-id.iam.gserviceaccount.com` |
| `GCS_BUCKET_NAME` | Your bucket name (without `gs://`) |

## 5. Access Your App

Once deployed, your app is available at:
```
https://storage.googleapis.com/YOUR_BUCKET_NAME/index.html
```

For a cleaner URL, point a custom domain or use a Cloud Load Balancer with Cloud CDN in front of the bucket.
