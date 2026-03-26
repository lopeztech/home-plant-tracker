terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # Remote state in GCS.
  # Create the bucket manually once: gsutil mb -l australia-southeast1 gs://YOUR_PROJECT_ID-tf-state
  # Then initialise with: terraform init -backend-config="bucket=YOUR_PROJECT_ID-tf-state"
  backend "gcs" {
    prefix = "plant-tracker/state"
  }
}
