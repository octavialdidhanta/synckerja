# Facebook commenter names — App Review & go-live runbook

Manage Comments shows **“Facebook user”** when Meta withholds `from.name` on Page post comments. Synckerja already requests Graph field `from`; unlocking real names requires Meta permissions/features below, then a Page reconnect.

## Required Meta access

| Type | Name | Notes |
|------|------|--------|
| Permission | `pages_read_user_content` | Read user-generated comments on Pages you manage. Dependency of `pages_manage_engagement`. Synckerja OAuth now requests this on Business + Facebook Page login configs. |
| Feature (not an OAuth scope) | **Business Asset User Profile Access** | App Review → Features. Allows reading User Fields (`name`, `picture`, …) for people engaging with your business assets. **Advanced Access** required for live personal-profile commenters. |

Supporting permissions (usually already requested): `pages_show_list`, `pages_manage_engagement`, `pages_read_engagement`, `pages_manage_metadata`.

Do **not** rely on Page Public Content Access for this use case — Manage Comments uses a connected Page access token.

## Meta Developer Dashboard checklist

1. **Business Verification** completed for the Meta app / Business Manager.
2. **Facebook Login for Business** configs:
   - Instagram/Business config (`VITE_META_OAUTH_CONFIG_ID`): include `pages_read_user_content`.
   - Facebook Page config (`VITE_META_FACEBOOK_OAUTH_CONFIG_ID`): include `pages_read_user_content`.
3. **App Review → Permissions**: request Advanced Access for `pages_read_user_content`.
4. **App Review → Features**: request **Business Asset User Profile Access** (Advanced Access).
5. Screencast + use case (copy-paste):

> Synckerja Manage Comments lets Page admins moderate Facebook Page posts and ads comments. We display each commenter’s public name so staff can reply with context (same information visible in native Facebook Page inbox). We call `GET /{page-post-id}/comments?fields=from,message,…` with a Page access token after the admin connects their Page. We need `pages_read_user_content` to read user comments and Business Asset User Profile Access so `from.name` is returned for personal profiles instead of anonymized placeholders.

6. Screencast steps:
   - Connect Facebook Page in Synckerja (`/omnichannel/integrations/facebook`).
   - Open Manage Comments → Facebook.
   - Open a post with comments from a personal Facebook profile.
   - Show commenter name in the thread and send a reply.
7. Until Live + Advanced Access: add pilot org admins as App testers / roles.

## After Meta approval

1. Deploy Synckerja build that includes `pages_read_user_content` in OAuth scope lists.
2. In Synckerja: **Reconnect Facebook Page** (rerequest permissions) at `/omnichannel/integrations/facebook`.
3. Confirm scope card **Facebook Comments** is green (`pages_manage_engagement` + `pages_read_user_content`).
4. Open Manage Comments → Facebook → refresh post comments.
5. Personal-profile commenters should show real `from.name` (not “Facebook user”).

## Verify with Graph API (optional)

With a Page access token that includes the new permission and BAUPA Advanced Access:

```bash
curl -s "https://graph.facebook.com/v22.0/{page-post-id}/comments?fields=from,message&access_token={PAGE_TOKEN}"
```

Expect `from.name` and `from.id` on personal-profile comments. Edge logs also report coverage:

`[metaContent] facebook comments filter=…: N/M with from.name`

## Sandbox vs production

| Mode | Who sees real names |
|------|---------------------|
| Development + app roles / testers | May see names before Advanced Access for those roles |
| Live + Advanced Access (BAUPA + `pages_read_user_content`) | Connected Pages for production customers |

If names stay anonymized after reconnect: confirm BAUPA Advanced Access is approved (feature, not only the OAuth permission), then reconnect again.

## Code references

- OAuth lists: `src/meta-platform/constants/metaOAuthScopes.ts`, `supabase/functions/_shared/metaPlatformScopes.ts`
- Graph fetch: `supabase/functions/_shared/metaContentApi.ts` (`fetchFacebookCommentsWithFilter`, `mapFbComment`)
- UI fallback: `src/6-0-social-media-manage-comments/components/meta/MetaCommentItem.tsx`
