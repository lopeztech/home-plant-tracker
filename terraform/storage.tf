# ── GCS Bucket ───────────────────────────────────────────────────────────────
# The bucket stores the compiled React app. It is kept private — the load
# balancer is the only authorised reader, so the raw gs:// URL is not usable
# by end-users. All traffic must go through HTTPS via the load balancer.

resource "google_storage_bucket" "app" {
  name                        = "${var.project_id}-${local.app_name}-${var.environment}"
  location                    = "US" # Multi-region for global CDN performance
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = false

  labels = local.labels

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # SPA: let React Router handle 404s
  }

  cors {
    origin          = ["https://${var.domain}"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.apis]
}

