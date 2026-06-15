# brick-bank-api

Consolidates `brick-account-link` + `brick-bank-sync` + Brick VA/disbursement webhook (saves edge function slots).

| `action` | Auth | Description |
|----------|------|-------------|
| `link` / `oauthStart` | JWT owner/admin | Start Brick Widget OAuth (bank account or Kartu Kredit debt) |
| `unlink` | JWT | Revoke OAuth connection |
| `status` | JWT | Link status for bank account or debt |
| `sync` / `syncAggregation` | JWT | OAuth aggregation sync (bank + CC) + VA/disburse poll + wallet balance |
| `createCloseVa` | JWT | Generate Close VA for piutang (`sales_activity_payment_id`) |
| `getVaStatus` | JWT | Poll VA status; optional `processUpdate: true` |
| `executeDisbursement` | JWT owner/admin | Send money (vendor/debt/payroll); rate limit 1/org/min |
| `getDisbursementStatus` | JWT | Poll disbursement; optional `processUpdate: true` |
| `simulateVa` | JWT | QA simulate PAID/COMPLETED (sandbox may 502) |
| POST webhook | no JWT | Brick VA + disbursement callback (`X-SIGNATURE`) |

## Brick Dashboard configuration

| Setting | Value |
|---------|--------|
| Virtual Account Callback URL | `https://<project-ref>.supabase.co/functions/v1/brick-bank-api` |
| Disbursement Callback URL | Same URL as Virtual Account Callback URL |
| Callback signature secret | Same as `BRICK_CALLBACK_SECRET` in Supabase secrets |

## Secrets

| Secret | Required | Notes |
|--------|----------|-------|
| `BRICK_CLIENT_ID` | yes* | Brick sandbox/production client ID |
| `BRICK_CLIENT_SECRET` | yes* | Brick client secret |
| `BRICK_CALLBACK_SECRET` | webhook | From Brick Dashboard → Callback Signature |
| `BRICK_WEBHOOK_SKIP_VERIFY` | dev only | `true` to skip signature check |
| `BRICK_USE_MOCK` | optional | `true` for local mock without real credentials |
| `BRICK_SANDBOX` | optional | default `true` unless `false` |
| `BRICK_TOKEN_ENCRYPTION_KEY` | OAuth | 32-byte key (hex/base64) for user access tokens |
| `BRICK_AGGREGATION_USE_MOCK` | dev | `true` for mock aggregation without real Brick Financial Data API |
| `BRICK_AGGREGATION_CALLBACK_URL` | OAuth | Override widget redirect (default: `.../brick-oauth-callback`) |
| `APP_PUBLIC_ORIGIN` | OAuth | Frontend origin for post-OAuth redirect (e.g. `https://app.example.com`) |

## OAuth functions

| Function | Description |
|----------|-------------|
| `brick-oauth-start` | POST — returns `widgetUrl` for Brick Widget |
| `brick-oauth-callback` | GET — receives `userAccessToken` + `state`, completes link, redirects to app |

See `scripts/brick-aggregation-oauth-qa.md` for sandbox QA.

## Deploy

```bash
npx supabase functions deploy brick-bank-api --no-verify-jwt
```

Delete after deploy (if created): `brick-account-link`, `brick-bank-sync`.

## VA settlement behavior

- **Synckerja VA** (`brick_payment_requests` linked): callback `paid` → mutasi + suggest match; `completed` → `apply_brick_va_settlement` (`deposit_source = brick_va`).
- **External VA** (manual Brick dashboard): mutasi + suggest only; finance confirms via `brick_mutasi`.

## Disbursement behavior

- **Source types**: `purchase_request`, `debt_payment`, `payroll_calculation`, `payroll_run` (batch).
- **Gate**: ≥1 `brick_link_status = linked` bank account; source account defaults to omnichannel linked account.
- **Account validation**: mandatory Brick API call before disbursement.
- **Callback** `data.type = disbursement`: updates `brick_disbursements`, ERP source rows, debit `bank_statement_lines` via RPC.
- **Poll fallback**: `sync` and `getDisbursementStatus` with `processUpdate: true`.
