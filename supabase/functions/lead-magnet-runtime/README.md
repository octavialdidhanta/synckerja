# lead-magnet-runtime

Service-role worker invoked by `instagram-webhook` for comment keyword triggers and DM postback handling.

## Deploy

```bash
npx supabase functions deploy lead-magnet-runtime --no-verify-jwt
```

## Auth

Requires `Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY`.
