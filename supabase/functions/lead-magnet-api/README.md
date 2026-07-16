# lead-magnet-api

JWT-authenticated CRUD for Lead Magnet campaigns, publish/pause, list media posts, and analytics.

## Deploy

```bash
npx supabase functions deploy lead-magnet-api --no-verify-jwt
```

Auth is enforced inside via `getUserFromBearer`.

## Routes

- `GET /` — list campaigns
- `POST /` — create campaign
- `GET /:id` — get campaign
- `PATCH /:id` — update campaign
- `DELETE /:id` — delete campaign
- `POST /:id/publish` — publish (status active)
- `POST /:id/pause` — pause campaign
- `GET /:id/analytics` — funnel counts + enrollments
- `POST /listMedia` — list IG/FB posts for wizard
