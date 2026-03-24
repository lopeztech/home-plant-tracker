variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region for regional resources"
  type        = string
  default     = "australia-southeast1"
}

variable "domain" {
  description = "Custom domain for the application (e.g. plants.example.com). Must have a DNS A record pointing to the load balancer IP after apply."
  type        = string
}

variable "environment" {
  description = "Deployment environment label (prod, staging, etc.)"
  type        = string
  default     = "prod"
}

variable "github_org" {
  description = "GitHub organisation or username that owns the repository"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without the org prefix)"
  type        = string
  default     = "home-plant-tracker"
}

variable "terraform_operator_email" {
  description = "Email of the user or service account running terraform apply (e.g. you@example.com). Will be granted the IAM roles required to provision all resources."
  type        = string
}

variable "cdn_default_ttl" {
  description = "Default CDN cache TTL in seconds for non-versioned assets"
  type        = number
  default     = 3600 # 1 hour
}

variable "cdn_max_ttl" {
  description = "Maximum CDN cache TTL in seconds"
  type        = number
  default     = 86400 # 24 hours
}
