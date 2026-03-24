# ── Terraform Operator IAM Roles ─────────────────────────────────────────────
# Grants the account running `terraform apply` the minimum roles needed to
# provision all resources in this configuration. The operator must already
# exist in GCP (e.g. a user account or a CI service account) — these bindings
# cannot bootstrap themselves from nothing, so run the initial apply as a
# project Owner, then these roles take over for subsequent runs.

locals {
  operator_member = length(regexall("^serviceAccount:", var.terraform_operator_email)) > 0 ? var.terraform_operator_email : "user:${var.terraform_operator_email}"

  operator_roles = [
    "roles/serviceusage.serviceUsageAdmin", # Enable / disable GCP APIs
    "roles/storage.admin",                  # Create and manage GCS buckets
    "roles/compute.admin",                  # Load balancer, CDN, SSL certs, forwarding rules
    "roles/iam.serviceAccountAdmin",        # Create and manage service accounts
    "roles/iam.workloadIdentityPoolAdmin",  # Create WIF pools and providers
  ]
}

resource "google_project_iam_member" "terraform_operator" {
  for_each = toset(local.operator_roles)

  project = var.project_id
  role    = each.value
  member  = local.operator_member
}

# ── Service Account — GitHub Actions Deployer ────────────────────────────────
# Least-privilege account used only to sync the dist/ build to the GCS bucket
# and invalidate Cloud CDN cache after each deployment.

resource "google_service_account" "github_deployer" {
  account_id   = "${local.app_name}-deployer"
  display_name = "Plant Tracker GitHub Actions Deployer"
  description  = "Used by GitHub Actions to deploy the React app to GCS"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

# Write access to the app bucket only
resource "google_storage_bucket_iam_member" "deployer_object_admin" {
  bucket = google_storage_bucket.app.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.github_deployer.email}"
}

# Allow CDN cache invalidation after deploys
resource "google_project_iam_member" "deployer_cdn_invalidator" {
  project = var.project_id
  role    = "roles/compute.networkAdmin"
  member  = "serviceAccount:${google_service_account.github_deployer.email}"
}

# ── Workload Identity Federation ──────────────────────────────────────────────
# Allows GitHub Actions to authenticate as the deployer service account without
# storing a long-lived JSON key. The OIDC token from GitHub is exchanged for a
# short-lived GCP access token automatically.

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "${local.app_name}-github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Identity pool for GitHub Actions OIDC tokens"
  project                   = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC Provider"
  project                            = var.project_id

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  # Map GitHub token claims to Google attributes.
  # attribute.repository restricts access to the specific repo below.
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.actor"      = "assertion.actor"
    "attribute.ref"        = "assertion.ref"
  }

  # Only tokens from main branch of the specified repo are accepted.
  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}' && assertion.ref == 'refs/heads/main'"
}

# Bind the WIF pool → service account impersonation
resource "google_service_account_iam_member" "github_wif_binding" {
  service_account_id = google_service_account.github_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}
