# IAP OAuth brand — one per project, represents the OAuth consent screen
resource "google_iap_brand" "app" {
  support_email     = var.terraform_operator_email
  application_title = "Plant Tracker"
  project           = var.project_id
  depends_on        = [google_project_service.apis]
}

# IAP OAuth client — credentials used by the LB to authenticate users
resource "google_iap_client" "app" {
  display_name = "Plant Tracker IAP Client"
  brand        = google_iap_brand.app.name
}

# Grant access to specific users — only these emails can pass IAP
resource "google_iap_web_backend_service_iam_binding" "access" {
  project             = var.project_id
  web_backend_service = google_compute_backend_service.app.name
  role                = "roles/iap.httpsResourceAccessor"
  members             = [for email in var.iap_allowed_users : "user:${email}"]
}
