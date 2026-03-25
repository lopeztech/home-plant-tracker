# ── Source bucket for function zips ──────────────────────────────────────────

resource "google_storage_bucket" "function_source" {
  name                        = "${var.project_id}-fn-source-${var.environment}"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = true

  labels = local.labels

  lifecycle_rule {
    condition { age = 30 }
    action    { type = "Delete" }
  }

  depends_on = [google_project_service.apis]
}

# ── Zip function source ───────────────────────────────────────────────────────

data "archive_file" "plants_function" {
  type        = "zip"
  source_dir  = "${path.module}/../api/plants"
  output_path = "${path.module}/tmp/plants.zip"
}

resource "google_storage_bucket_object" "plants_function_source" {
  name   = "plants-${data.archive_file.plants_function.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.plants_function.output_path
}

# ── Service account for the function ─────────────────────────────────────────

resource "google_service_account" "plants_function" {
  account_id   = "${local.app_name}-plants-fn"
  display_name = "Plant Tracker Plants Function"
  description  = "Service account for the plants CRUD Cloud Function"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "plants_function_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.plants_function.email}"
}

# ── Cloud Function (2nd gen) ──────────────────────────────────────────────────

resource "google_cloudfunctions2_function" "plants" {
  name        = "${local.app_name}-plants-api"
  location    = var.region
  description = "Plant Tracker CRUD API"
  project     = var.project_id

  build_config {
    runtime     = "nodejs20"
    entry_point = "plantsApi"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.plants_function_source.name
      }
    }
  }

  service_config {
    service_account_email          = google_service_account.plants_function.email
    max_instance_count             = 5
    min_instance_count             = 0
    available_memory               = "256M"
    timeout_seconds                = 60
    ingress_settings               = "ALLOW_ALL"
    all_traffic_on_latest_revision = true

    environment_variables = {
      PROJECT_ID            = var.project_id
      IMAGES_BUCKET         = google_storage_bucket.images.name
      SERVICE_ACCOUNT_EMAIL = google_service_account.plants_function.email
    }
  }

  labels = local.labels

  depends_on = [
    google_project_service.apis,
    google_storage_bucket_object.plants_function_source,
  ]
}

# ── Allow API Gateway's managed SA to invoke the function ────────────────────
# The API Gateway managed SA is auto-created when the API Gateway API is enabled.

resource "google_cloudfunctions2_function_iam_member" "api_gateway_invoker" {
  project        = var.project_id
  location       = var.region
  cloud_function = google_cloudfunctions2_function.plants.name
  role           = "roles/cloudfunctions.invoker"
  member         = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-apigateway.iam.gserviceaccount.com"

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "api_gateway_run_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloudfunctions2_function.plants.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-apigateway.iam.gserviceaccount.com"
}

# The API Gateway signs JWTs as the plants_function SA (via backend_config.google_service_account).
# Cloud Run must accept that SA as an invoker.
resource "google_cloud_run_v2_service_iam_member" "function_sa_run_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloudfunctions2_function.plants.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.plants_function.email}"
}

# Allow the function SA to sign blobs — required for generating v4 signed URLs in Cloud Run.
resource "google_service_account_iam_member" "plants_fn_self_sign" {
  service_account_id = google_service_account.plants_function.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.plants_function.email}"
}

# Allow the API Gateway managed SA to impersonate the function SA (needed to sign JWTs for the backend).
resource "google_service_account_iam_member" "api_gateway_impersonate_fn_sa" {
  service_account_id = google_service_account.plants_function.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.project.number}@gcp-sa-apigateway.iam.gserviceaccount.com"
}
