# share-caption-suggest

Edge API for Share-to-Publish caption `@` / `#` suggestions.

## Deploy

```bash
npm run supabase:functions:deploy:share-caption-suggest
```

Requires `SUPABASE_ACCESS_TOKEN` and migration `20260729140000_organization_caption_suggest.sql` applied.

## Actions (POST JSON)

| action | body | response |
|--------|------|----------|
| `mentions` | `organization_id`, `q` | `{ mentions: [{ handle, displayName, source }] }` |
| `resolve_mention` | `organization_id`, `handle`, optional `save` | `{ mention }` + optional save to curated table |
| `hashtags` | `organization_id`, `q`, `title`, `pillar` | `{ hashtags: [{ tag, source }] }` |

Sources: `curated` (org tables), `history` (brief_captions), `meta` (Instagram `business_discovery` exact), `plan` (title/pillar tokens).

## Smoke

1. Apply migration.
2. Deploy function.
3. With an org that has an active Instagram Business account, call `resolve_mention` for a known Business/Creator username.
4. Open Share-to-Publish caption, type `@` — curated/history should appear; exact handle may enrich from Meta.
