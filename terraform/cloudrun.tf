# Artifact Registry repository for Docker images
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "${local.app_name}-images"
  description   = "Docker images for Plant Tracker"
  format        = "DOCKER"
  project       = var.project_id
  depends_on    = [google_project_service.apis]
}

# Grant deployer SA permission to push images
resource "google_artifact_registry_repository_iam_member" "deployer_writer" {
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_deployer.email}"
  project    = var.project_id
}

# Cloud Run service — traffic only via internal LB (not public internet)
resource "google_cloud_run_v2_service" "app" {
  name     = local.app_name
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    containers {
      # Placeholder image for initial terraform apply.
      # CI/CD will deploy the real image — Terraform ignores image changes after creation.
      image = "us-docker.pkg.dev/cloudrun/container/hello"
      ports {
        container_port = 8080
      }
      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [google_project_service.apis]
}

# Allow the load balancer to invoke Cloud Run.
# Ingress is restricted to INTERNAL_LOAD_BALANCER so only the LB can reach it
# even though allUsers is granted here.
resource "google_cloud_run_v2_service_iam_member" "lb_invoker" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Serverless NEG connecting the Load Balancer to Cloud Run
resource "google_compute_region_network_endpoint_group" "app" {
  name                  = "${local.app_name}-neg-${var.environment}"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id

  cloud_run {
    service = google_cloud_run_v2_service.app.name
  }

  depends_on = [google_project_service.apis]
}
