/**
 * Batch upload pending Google Ads offline conversions (pg_cron hourly).
 *
 * Deploy: supabase functions deploy google-ads-upload-pending-conversions
 * Auth: service role / secret key (Authorization Bearer or apikey header)
 */
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fetchPendingGoogleAdsConversionCandidates,
  processGoogleAdsConversionUpload,
} from "../_shared/googleAdsConversionUpload.ts";
import {
  isAuthorizedServiceCaller,
  resolveSupabaseAdminKey,
} from "../_shared/serviceRoleEdgeAuth.ts";

const BATCH_LIMIT = 50;

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = resolveSupabaseAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server misconfigured" }, 500);
  }

  if (!isAuthorizedServiceCaller(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const candidates = await fetchPendingGoogleAdsConversionCandidates(admin, BATCH_LIMIT);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates) {
    const result = await processGoogleAdsConversionUpload(
      admin,
      row.organization_id,
      row.lead_id,
      {
        salesActivityId: row.sales_activity_id,
        skipIfSuccess: true,
        incrementAttempt: true,
      },
    );

    if (result.uploaded) success += 1;
    else if (result.skipped || result.duplicate) skipped += 1;
    else if (!result.ok) failed += 1;
    else skipped += 1;
  }

  return json({
    ok: true,
    processed: candidates.length,
    success,
    failed,
    skipped,
  }, 200);
});
