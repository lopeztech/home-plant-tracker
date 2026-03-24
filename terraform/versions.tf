terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Remote state in GCS — create this bucket manually first (see README),
  # then uncomment before running terraform init.
  # backend "gcs" {
  #   bucket = "YOUR_PROJECT_ID-tf-state"
  #   prefix = "plant-tracker"
  # }
}
