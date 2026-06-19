# Meta Platform Module

OAuth scopes, Graph API version, and organic content (comments + insights) for Facebook Pages and Instagram Business.

## OAuth scopes

Defined in `constants/metaOAuthScopes.ts` — used by Connect Instagram and validated in edge via `_shared/metaPlatformScopes.ts`.

Meta Ads (`ads_read`) uses a **separate** OAuth flow in `meta-ads-oauth-start`.

## Token storage

- Instagram + linked FB Page: `organization_instagram_accounts`
- FB-only pages: `organization_facebook_pages`

## Edge functions

| Function | Purpose |
|----------|---------|
| `meta-content-config` | List accounts + scope status |
| `meta-content-comments` | Posts, comments, reply, inbox state |
| `meta-content-metrics` | Account + media insights |

## Frontend

- `src/meta-content/` — hooks
- Manage comments UI: `6-0-social-media-manage-comments/pages/MetaManageCommentsPage.tsx`
- Performance UI: `6-0-social-media-performance/pages/MetaContentPerformancePage.tsx`

See `SANDBOX_CHECKLIST.md` for internal testing steps.
