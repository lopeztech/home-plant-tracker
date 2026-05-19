# Activate the Family Plan add-on

This is the one-time manual setup to go live with the Family Plan ($4.99/mo or $49/yr) add-on on top of `home_pro`. Pre-reqs: Stripe is already activated for the main subscription tiers (the steps in #239 are complete).

## Step 1 — Create the Family Plan Product + Prices

1. Sign in to https://dashboard.stripe.com — verify the test/live toggle matches the mode you're configuring.
2. Go to https://dashboard.stripe.com/products (drop `/test/` for live).
3. Click **+ Add product**:
   - **Name:** `Family Plan`
   - **Description:** `Share a Home Pro garden with up to 5 household members. Each member signs in, shares the plant collection and floorplan.`
   - Under **Pricing**, choose **Recurring**.
   - **Price 1 — monthly:** Amount `4.99 USD`, Billing period `Monthly`.
   - Click **Add another price**.
   - **Price 2 — annual:** Amount `49.00 USD`, Billing period `Yearly`.
   - Save.
4. Open the saved product, click each `price_...` ID and copy both into a scratch note.

```
STRIPE_PRICE_FAMILY_MONTHLY = price_...
STRIPE_PRICE_FAMILY_ANNUAL  = price_...
```

## Step 2 — Add the price IDs to Terraform

In `platform-infra/projects/home-plant-tracker/environments/prod.tfvars` add:

```hcl
stripe_price_family_monthly = "price_..."
stripe_price_family_annual  = "price_..."
```

Commit and push to `platform-infra/master` — the apply workflow redeploys the Cloud Function with the new env vars within a few minutes. Verify:

```sh
gcloud run revisions list --service plant-tracker-plants-api --region <region> --limit 1
```

## Step 3 — Verify the add-on resolves end-to-end

**Backend sanity check:**

```sh
curl -sS https://api.plants.lopezcloud.dev/billing/subscription \
  -H "x-api-key: $API_KEY" -H "Authorization: Bearer <JWT>"
```

Expected (when the user has no add-ons): `"addons": []`, `"quotas": { ..., "household_members": 1 }` for `home_pro`.

**Checkout with the add-on:**

```sh
curl -sS -X POST https://api.plants.lopezcloud.dev/billing/create-checkout-session \
  -H "x-api-key: $API_KEY" -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"tier":"home_pro","interval":"month","addons":["family"]}'
```

Should return a `checkout.stripe.com` URL with both line items. Pay with test card `4242 4242 4242 4242`. Within a few seconds the user's `subscription.addons.family` should be `true` and `quotas.household_members` should be `5`.

**Webhook verification:** at https://dashboard.stripe.com/test/webhooks open your existing endpoint → Events tab → confirm `checkout.session.completed` arrived with status 200.

## What this does NOT do

This is the **backend & Stripe wiring** only. It deliberately leaves the user-facing flow untouched:

- The frontend pricing page does NOT yet show a Family Plan upgrade CTA.
- The household members API does NOT yet enforce `household_members` quota at the route layer (existing households remain uncapped).
- No grandfathering migration runs.

A follow-up PR will wire the UI prompt (Settings → Family, pricing page) and turn on the `household_members` quota check in `households.js` with a grandfather rule for existing multi-member households.

## Switch to live mode

Repeat Step 1 in live mode, set the new live `price_...` IDs in `prod.tfvars` (replace the existing values; don't add new variables), and re-apply.
