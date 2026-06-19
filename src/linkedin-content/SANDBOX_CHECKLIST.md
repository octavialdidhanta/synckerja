# LinkedIn Sandbox — Internal Test Checklist

## Prerequisites

1. LinkedIn Developer App with **Community Management API** status **Added**.
2. Run migration `20260820120000_linkedin_threads_content_platform.sql`.
3. Deploy edge function: `npx supabase functions deploy linkedin-content-api --no-verify-jwt --use-api`
4. Secrets: `LINKEDIN_CONTENT_CLIENT_ID`, `LINKEDIN_CONTENT_CLIENT_SECRET`
5. Redirect URL: `https://<project-ref>.supabase.co/functions/v1/linkedin-content-api`

## 1. OAuth & settings (`/digital-marketing/social-media-performance/linkedin/settings`)

- [ ] Connect LinkedIn page — no `invalid_scope_error`
- [ ] Scope status cards green for Comments, Insights, Pages
- [ ] `granted_scopes` saved on `organization_linkedin_content_accounts`

## 2. Performance (`/digital-marketing/social-media-performance/linkedin`)

- [ ] Collapsible account nav, multi-page switch
- [ ] Summary bar: **Followers** + posts metrics load together
- [ ] Posts table + date range
- [ ] Skeleton → content without flicker on hard refresh

## 3. Manage Comments (`/manage-comments/linkedin`)

- [ ] LinkedIn tab enabled in platform picker
- [ ] Post list clickable, filters work, `contentKind=post`
- [ ] Thread panel: preview + sky-50 comment bubbles (TikTok/Meta style)
- [ ] Reply from app → appears on LinkedIn
- [ ] Nested replies load via View replies
- [ ] "Open on LinkedIn" link works

## 4. Report (`/digital-marketing/social-media-performance/report`)

- [ ] LinkedIn audience not Hidden
- [ ] Metrics load with other platforms
- [ ] Target progress includes LinkedIn accounts
