# ── API Gateway ───────────────────────────────────────────────────────────────

resource "google_api_gateway_api" "app" {
  provider = google-beta
  api_id   = "${local.app_name}-api"
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_api_gateway_api_config" "app" {
  provider      = google-beta
  api           = google_api_gateway_api.app.api_id
  api_config_id = "${local.app_name}-config-${replace(substr(google_cloudfunctions2_function.plants.update_time, 0, 10), "-", "")}"
  project       = var.project_id

  openapi_documents {
    document {
      path = "openapi.yaml"
      contents = base64encode(templatefile("${path.module}/openapi.yaml.tpl", {
        function_url = google_cloudfunctions2_function.plants.service_config[0].uri
      }))
    }
  }

  gateway_config {
    backend_config {
      google_service_account = google_service_account.plants_function.email
    }
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_project_service.apis]
}

resource "google_api_gateway_gateway" "app" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.app.id
  gateway_id = "${local.app_name}-gateway-${var.environment}"
  region     = var.region
  project    = var.project_id

  labels = local.labels

  depends_on = [google_project_service.apis]
}

# ── API Key ───────────────────────────────────────────────────────────────────

resource "google_apikeys_key" "app" {
  name         = "${local.app_name}-api-key-${var.environment}"
  display_name = "Plant Tracker API Key"
  project      = var.project_id

  restrictions {
    api_targets {
      service = google_api_gateway_api.app.managed_service
    }
  }

  depends_on = [google_project_service.apis]
}
