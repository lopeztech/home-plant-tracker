# ── Gemini API key in Secret Manager ─────────────────────────────────────────

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "${local.app_name}-gemini-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = local.labels

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

# ── Grant the function SA read access to the secret ──────────────────────────

resource "google_secret_manager_secret_iam_member" "plants_function_gemini_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.plants_function.email}"
}
