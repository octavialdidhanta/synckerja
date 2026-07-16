# Lead Magnet Module (`6-1-lead-magnet`)

ManyChat-style comment → DM automation for Instagram and Facebook Page.

## Routes

- `/digital-marketing/lead-magnet` — campaign list
- `/digital-marketing/lead-magnet/new` — create wizard
- `/digital-marketing/lead-magnet/:id/edit` — edit wizard
- `/digital-marketing/lead-magnet/:id/analytics` — funnel dashboard

## API

Edge function `lead-magnet-api` — see [README](../../supabase/functions/lead-magnet-api/README.md).

## Runtime

Shared library: `supabase/functions/_shared/leadMagnet/`

Invoked by `instagram-webhook` via `lead-magnet-runtime`.
