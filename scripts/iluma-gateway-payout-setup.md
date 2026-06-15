# Iluma Gateway Payout Bank Validation — Setup

Required before production gateway withdrawals with real bank validation.

## 1. Iluma account

1. Contact Xendit / Iluma to enable **Bank Name Validator** (Iluma Data Services).
2. Obtain API keys: `iluma_development_*` (sandbox) and `iluma_production_*` (live).

## 2. Supabase secrets

```bash
npx supabase secrets set ILUMA_API_KEY=iluma_development_...
# optional:
npx supabase secrets set ILUMA_ENV=sandbox
npx supabase secrets set ILUMA_WEBHOOK_TOKEN=<callback-auth-token-from-iluma-dashboard>
# local QA only (never production):
npx supabase secrets set ILUMA_USE_MOCK=true
```

## 3. Iluma callback URL

In Iluma dashboard, set callback type `NAME_VALIDATOR_REQUEST` to:

```
https://<project-ref>.supabase.co/functions/v1/xendit-api
```

Same edge function as Xendit webhooks (`--no-verify-jwt`). Iluma requests are detected by `x-iluma-callback-token` or payload shape.

## 4. Deploy

```bash
npx supabase functions deploy xendit-api --no-verify-jwt
```

## 5. Apply migration

`20260725120000_gateway_payout_bank_validation.sql`

Existing org payout banks are backfilled to `stale` — admin must re-validate in Bank Accounts or Xendit settings before **Tarik Dana**.
