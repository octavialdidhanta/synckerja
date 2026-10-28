# Deploy `meta-ads-targeting` (manual)

Paste your personal access token (`sbp_…`) when prompted / into the env var below.

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_PASTE_HERE"
npx supabase functions deploy meta-ads-targeting --project-ref wqdzqqshoifwyrltzgvx --no-verify-jwt
```

Or with CLI already logged in:

```powershell
npx supabase functions deploy meta-ads-targeting --project-ref wqdzqqshoifwyrltzgvx --no-verify-jwt
```

After deploy, open `/digital-marketing/meta-ads/interest-research`, pick an ad account.

Fase 2 smoke:
1. Select 2 interests → **Overlap** → right rail shows Estimasi panel (A/B/union)
2. Select 1 interest or life event → **Estimate reach** → Reach panel (users + MAU)
3. Explore → breadcrumb → select interests → **Explore deeper**; toggle Hide broad behaviours
4. **Diagnostics** → Run spike (Fase 0 health check)

Shared code used by this function:

- `supabase/functions/meta-ads-targeting/index.ts`
- `supabase/functions/_shared/metaAdsTargetingApi.ts`
- `supabase/functions/_shared/metaAdsOrgResolver.ts` (`resolveOrgMetaAdsForTargeting`)
- `supabase/functions/_shared/metaAdsAuth.ts`
