# ── OAuth Consent Screen + Client ID ─────────────────────────────────────────
# Google IAP brands cannot be created via API for personal (non-Organisation)
# GCP projects. Create the OAuth client manually then set google_oauth_client_id
# in terraform.tfvars.
#
# One-time manual setup:
#   1. Cloud Console → APIs & Services → OAuth consent screen
#      - User type: External → Create
#      - App name: Plant Tracker, support email: joshua.lopez.tech@gmail.com
#      - Save and continue through all steps
#   2. Cloud Console → APIs & Services → Credentials → Create Credentials
#      → OAuth 2.0 Client ID
#      - Application type: Web application
#      - Name: Plant Tracker
#      - Authorised JavaScript origins: https://plants.lopezcloud.dev
#        and http://localhost:5173 (for local dev)
#      - Copy the Client ID → set as google_oauth_client_id in terraform.tfvars
#        and as VITE_GOOGLE_CLIENT_ID in GitHub Secrets
