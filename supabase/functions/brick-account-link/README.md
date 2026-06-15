# brick-account-link

Link / unlink a `bank_accounts` row to Brick via account validation.

```bash
supabase functions deploy brick-account-link
```

Includes local `brickApi.ts` and `brickAuth.ts` — deploy the full folder, not only `index.ts`.

See `brick-bank-sync/README.md` for secrets (`BRICK_CLIENT_ID`, `BRICK_CLIENT_SECRET`, `BRICK_USE_MOCK`).
