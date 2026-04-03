# Platform-Infra: Vertex AI ML Infrastructure Plan

**Project:** `home-plant-tracker-491202`
**Region:** `australia-southeast1` (existing), `us-central1` (Vertex AI — lowest latency for ML)
**Backend Function:** `plant-tracker-plants-api` (Cloud Run Function, Gen 2, Node.js 20)
**API Gateway:** `plant-tracker-gateway-dev` (OpenAPI 2.0 at `api.plants.lopezcloud.dev`)

---

## Context

The application code in `home-plant-tracker` already implements:
- `healthLog` tracking on every plant health change (appended on PUT /plants/:id)
- `GET /ml/export` endpoint — produces NDJSON feature table from all users' plant data (admin-gated via `x-admin-token` header)
- `GET /plants/:id/watering-pattern` — heuristic watering pattern analysis (to be enhanced with ML predictions)
- `pot_size` field on plant documents (small/medium/large/xl)
- Feature engineering: species, days_between_waterings, recommended_frequency, adherence_ratio, health_at_watering, health_7d_after, season, consecutive_overdue_days, pot_size, room

This plan covers the GCP infrastructure changes needed to enable ML-powered features.

---

## Phase 1: Foundation (Issue #95)

### 1.1 Enable Vertex AI API

```hcl
resource "google_project_service" "aiplatform" {
  project = var.project_id
  service = "aiplatform.googleapis.com"
}
```

### 1.2 Vertex AI Service Account

Create a dedicated service account for Vertex AI operations:

```hcl
resource "google_service_account" "vertex_ai" {
  account_id   = "plant-tracker-vertex-ai"
  display_name = "Plant Tracker Vertex AI"
  project      = var.project_id
}

resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.vertex_ai.email}"
}

resource "google_project_iam_member" "vertex_ai_ml_developer" {
  project = var.project_id
  role    = "roles/ml.developer"
  member  = "serviceAccount:${google_service_account.vertex_ai.email}"
}
```

### 1.3 Secret Manager Entries

```hcl
# ML Admin Token — protects the /ml/export endpoint
resource "google_secret_manager_secret" "ml_admin_token" {
  secret_id = "ml-admin-token"
  project   = var.project_id
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "ml_admin_token" {
  secret      = google_secret_manager_secret.ml_admin_token.id
  secret_data = var.ml_admin_token  # Add to terraform.tfvars
}
```

### 1.4 Cloud Run Function Environment Variables

Add these env vars to the existing `plant-tracker-plants-api` Cloud Run Function:

| Variable | Source | Description |
|----------|--------|-------------|
| `ML_ADMIN_TOKEN` | Secret Manager `ml-admin-token` | Auth token for `/ml/export` |
| `VERTEX_AI_PROJECT` | `var.project_id` | GCP project for Vertex AI calls |
| `VERTEX_AI_LOCATION` | `us-central1` | Vertex AI region |
| `VERTEX_AI_PATTERN_ENDPOINT` | Terraform output | Watering pattern model endpoint ID |
| `VERTEX_AI_HEALTH_ENDPOINT` | Terraform output | Health prediction model endpoint ID |
| `VERTEX_AI_FREQUENCY_ENDPOINT` | Terraform output | Frequency recommendation model endpoint ID |
| `VERTEX_AI_ANOMALY_ENDPOINT` | Terraform output | Anomaly detection model endpoint ID |

### 1.5 Grant Cloud Run Function Access to Vertex AI

```hcl
# Allow the Cloud Run Function's service account to call Vertex AI
resource "google_project_iam_member" "function_vertex_ai_predict" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${var.function_service_account_email}"
}
```

---

## Phase 2: Data Pipeline (Issue #96)

### 2.1 ML Data Export Bucket

```hcl
resource "google_storage_bucket" "ml_data" {
  name          = "${var.project_id}-ml-data"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 90  # Keep exports for 90 days
    }
  }

  uniform_bucket_level_access = true
}

# Grant the function's SA write access
resource "google_storage_bucket_iam_member" "ml_data_writer" {
  bucket = google_storage_bucket.ml_data.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${var.function_service_account_email}"
}

# Grant Vertex AI SA read access for training
resource "google_storage_bucket_iam_member" "ml_data_vertex_reader" {
  bucket = google_storage_bucket.ml_data.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.vertex_ai.email}"
}
```

### 2.2 Cloud Scheduler — Weekly ML Export

Triggers `GET /ml/export` weekly and writes the result to the ML data bucket:

```hcl
resource "google_cloud_scheduler_job" "ml_export" {
  name        = "plant-tracker-ml-export-weekly"
  description = "Weekly ML training data export"
  project     = var.project_id
  region      = var.region
  schedule    = "0 3 * * 0"  # Every Sunday at 3 AM
  time_zone   = "Australia/Sydney"

  http_target {
    uri         = "${google_cloudfunctions2_function.plants_api.url}/ml/export"
    http_method = "GET"
    headers = {
      "x-admin-token" = google_secret_manager_secret_version.ml_admin_token.secret_data
    }
  }
}
```

> **Note:** The export endpoint streams NDJSON directly. You may want to add a lightweight Cloud Function or Cloud Run job that calls `/ml/export`, saves the result to `gs://${var.project_id}-ml-data/exports/YYYY-MM-DD.ndjson`, and then triggers a Vertex AI dataset import.

### 2.3 Vertex AI Tabular Dataset

```hcl
resource "google_vertex_ai_dataset" "plant_care" {
  display_name        = "plant-tracker-care-data"
  metadata_schema_uri = "gs://google-cloud-aiplatform/schema/dataset/metadata/tabular_1.0.0.yaml"
  project             = var.project_id
  region              = "us-central1"
}
```

---

## Phase 3: Model Training & Endpoints (Issues #97-103)

### 3.1 API Gateway — New Endpoints

Add these routes to the OpenAPI spec in `api/openapi.yaml` (or manage via Terraform if the spec is generated):

```yaml
/plants/{plantId}/watering-pattern:
  get:
    operationId: getWateringPattern
    summary: Analyse watering pattern for a plant
    parameters:
      - name: plantId
        in: path
        required: true
        type: string
    security:
      - api_key: []
    responses:
      200:
        description: Watering pattern analysis
    x-google-backend:
      deadline: 10.0

/plants/{plantId}/health-prediction:
  get:
    operationId: getHealthPrediction
    summary: Predict plant health trajectory
    parameters:
      - name: plantId
        in: path
        required: true
        type: string
    security:
      - api_key: []
    responses:
      200:
        description: Health prediction
    x-google-backend:
      deadline: 10.0

/plants/{plantId}/watering-recommendation:
  get:
    operationId: getWateringRecommendation
    summary: ML-recommended watering schedule
    parameters:
      - name: plantId
        in: path
        required: true
        type: string
    security:
      - api_key: []
    responses:
      200:
        description: Watering recommendation
    x-google-backend:
      deadline: 10.0

/ml/status:
  get:
    operationId: mlStatus
    summary: ML service health check
    security:
      - api_key: []
    responses:
      200:
        description: ML status
```

### 3.2 Model Training Jobs

Train these models using AutoML Tabular once sufficient data is collected (minimum ~1,000 rows):

| Model | Issue | Type | Target Label | Min Rows |
|-------|-------|------|-------------|----------|
| Watering Pattern | #97 | Classification (4-class) | `watering_pattern` (optimal/over/under/inconsistent) | 1,000 |
| Health Prediction | #98 | Classification (4-class) | `health_7d_after` (Excellent/Good/Fair/Poor) | 1,000 |
| Watering Frequency | #99 | Regression | `optimal_frequency_days` | 500 |
| Anomaly Detection | #100 | Anomaly Detection (unsupervised) | N/A | 500 |

**Training can be triggered manually or via Vertex AI Pipelines.** Until sufficient real data exists, the application uses heuristic fallbacks (already implemented in `analyseWateringPattern()`).

### 3.3 Vertex AI Endpoints

Deploy each trained model to a prediction endpoint:

```hcl
resource "google_vertex_ai_endpoint" "watering_pattern" {
  display_name = "plant-tracker-watering-pattern"
  project      = var.project_id
  location     = "us-central1"
}

resource "google_vertex_ai_endpoint" "health_prediction" {
  display_name = "plant-tracker-health-prediction"
  project      = var.project_id
  location     = "us-central1"
}

resource "google_vertex_ai_endpoint" "watering_frequency" {
  display_name = "plant-tracker-watering-frequency"
  project      = var.project_id
  location     = "us-central1"
}

resource "google_vertex_ai_endpoint" "anomaly_detection" {
  display_name = "plant-tracker-anomaly-detection"
  project      = var.project_id
  location     = "us-central1"
}
```

### 3.4 Endpoint Keep-Warm Scheduler

Prevent cold starts by pinging endpoints every 5 minutes:

```hcl
resource "google_cloud_scheduler_job" "ml_warmup" {
  name        = "plant-tracker-ml-endpoint-warmup"
  description = "Keep Vertex AI endpoints warm"
  project     = var.project_id
  region      = var.region
  schedule    = "*/5 * * * *"
  time_zone   = "UTC"

  http_target {
    uri         = "${google_cloudfunctions2_function.plants_api.url}/ml/status"
    http_method = "GET"
    headers = {
      "x-api-key" = var.api_key
    }
  }
}
```

### 3.5 Model Monitoring

```hcl
resource "google_vertex_ai_model_deployment_monitoring_job" "pattern_monitor" {
  display_name = "plant-tracker-pattern-model-monitor"
  project      = var.project_id
  location     = "us-central1"
  endpoint     = google_vertex_ai_endpoint.watering_pattern.id

  model_deployment_monitoring_objective_configs {
    deployed_model_id = "watering-pattern-v1"
    objective_config {
      prediction_drift_detection_config {
        drift_thresholds {
          key   = "pattern"
          value { value = 0.3 }
        }
      }
    }
  }

  logging_sampling_strategy {
    random_sample_config {
      sample_rate = 0.8
    }
  }
}
```

---

## Phase 4: Daily Anomaly Detection (Issue #100)

### 4.1 Cloud Scheduler — Daily Anomaly Scan

```hcl
resource "google_cloud_scheduler_job" "anomaly_scan" {
  name        = "plant-tracker-anomaly-scan-daily"
  description = "Daily anomaly detection across all plants"
  project     = var.project_id
  region      = var.region
  schedule    = "0 8 * * *"  # Daily at 8 AM
  time_zone   = "Australia/Sydney"

  http_target {
    uri         = "${google_cloudfunctions2_function.plants_api.url}/ml/anomaly-scan"
    http_method = "POST"
    headers = {
      "x-admin-token" = google_secret_manager_secret_version.ml_admin_token.secret_data
    }
  }
}
```

---

## Terraform Variables to Add

Add to `terraform.tfvars`:

```hcl
ml_admin_token = "<generate-a-secure-random-token>"
```

Add to `variables.tf`:

```hcl
variable "ml_admin_token" {
  type        = string
  sensitive   = true
  description = "Admin token for ML export and anomaly scan endpoints"
}
```

---

## Terraform Outputs to Add

```hcl
output "ml_data_bucket" {
  value = google_storage_bucket.ml_data.name
}

output "vertex_ai_dataset_id" {
  value = google_vertex_ai_dataset.plant_care.name
}

output "vertex_ai_pattern_endpoint" {
  value = google_vertex_ai_endpoint.watering_pattern.name
}

output "vertex_ai_health_endpoint" {
  value = google_vertex_ai_endpoint.health_prediction.name
}

output "vertex_ai_frequency_endpoint" {
  value = google_vertex_ai_endpoint.watering_frequency.name
}

output "vertex_ai_anomaly_endpoint" {
  value = google_vertex_ai_endpoint.anomaly_detection.name
}
```

---

## Implementation Order

```
Phase 1 (Foundation — do first, no model training needed)
  1. Enable aiplatform.googleapis.com API
  2. Create Vertex AI service account + IAM bindings
  3. Create ML_ADMIN_TOKEN in Secret Manager
  4. Add new env vars to Cloud Run Function
  5. Grant function SA roles/aiplatform.user

Phase 2 (Data Pipeline — enables data collection)
  6. Create ML data export GCS bucket
  7. Set up weekly Cloud Scheduler export job
  8. Create Vertex AI Tabular Dataset

Phase 3 (Models — after sufficient data accumulates)
  9.  Update API Gateway OpenAPI spec with new routes
  10. Create Vertex AI endpoints (empty, awaiting model deployment)
  11. Train models when dataset reaches minimum row thresholds
  12. Deploy models to endpoints
  13. Set up endpoint keep-warm scheduler

Phase 4 (Monitoring & Automation)
  14. Configure model drift monitoring
  15. Set up daily anomaly scan scheduler
  16. Monthly re-training pipeline (optional, via Vertex AI Pipelines)
```

---

## Cost Considerations

- **Vertex AI AutoML Training:** ~$3-20 per training hour (varies by model size)
- **Vertex AI Prediction Endpoints:** ~$0.04/node-hour for online predictions. Consider using batch prediction for cost savings if real-time is not critical
- **Cloud Storage:** Negligible for ML data (<1 GB expected)
- **Cloud Scheduler:** Free tier covers all jobs above
- **Recommendation:** Start with Phase 1-2, monitor data accumulation, train models only when thresholds are met. Use heuristic fallbacks (already coded) until ML endpoints are ready
