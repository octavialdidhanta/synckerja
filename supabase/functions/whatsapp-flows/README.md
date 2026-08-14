# whatsapp-flows

Edge proxy to Meta [WhatsApp Flows API](https://developers.facebook.com/docs/whatsapp/flows/reference/flowsapi/) for the active organization’s WhatsApp Business Account (WABA).

## Auth

- `Authorization: Bearer <Supabase user JWT>` (same pattern as `whatsapp-message-templates`).
- `verify_jwt = false` in `supabase/config.toml`; JWT is validated inside the function.

## Environment

Uses existing secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, plus org rows:

- `organization_meta_config` / `organization_whatsapp_accounts` for `whatsapp_business_account_id`, `meta_access_token`, optional `phone_number_id` (to resolve WABA).

The Meta access token must include **WhatsApp Business Management** permissions required for `/{WABA-ID}/flows`.

## Methods

### `GET /functions/v1/whatsapp-flows`

Lists flows. Optional query: `fields` (default `id,name,status,categories`). Request `updated_at` for last-modified timestamps (Meta Graph API "UpdatedAt" field).

### `POST /functions/v1/whatsapp-flows`

Creates (and optionally publishes) a flow.

Body (JSON):

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Internal name: `^[a-z0-9_]{1,128}$` |
| `categories` | yes | Non-empty array of Meta categories (e.g. `OTHER`, `LEAD_GENERATION`, `SURVEY`, …) |
| `flow_json` | yes | Object or stringified JSON per Meta (string is sent to Graph) |
| `publish` | no | If `true`, publish when Meta accepts the JSON |
| `endpoint_uri` | no | Required for some Flow JSON / `data_exchange` setups |

Response: `{ success: true, result: <Graph response> }` including `id`, `validation_errors`, etc.

### `POST` with `action: "publish"`

Publishes a draft flow. Body: `{ "action": "publish", "flow_id": "<META_FLOW_ID>" }`.

### `POST` with `action: "delete"`

Deletes a draft flow from Meta (only flows in `DRAFT` status). Body: `{ "action": "delete", "flow_id": "<META_FLOW_ID>" }`.

Published flows cannot be deleted via Meta; use Meta’s deprecate API separately if needed.

### `GET` with `flow_id` query

Fetches a single flow plus downloadable `flow_json` asset. Example: `GET /whatsapp-flows?flow_id=123456789`.

Response: `{ flow: { id, name, status, categories, updated_at }, flow_json: object | null }`.

### `POST` with `action: "update"`

Updates flow JSON (and optional metadata) on Meta. Body: `{ "action": "update", "flow_id": "<ID>", "flow_json": { ... } }`.

Editing a published flow returns it to **DRAFT** until published again.

## Limits

- `flow_json` is capped at **256 KB** after stringify (see `MAX_FLOW_JSON_BYTES` in `index.ts`).
