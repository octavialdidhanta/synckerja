/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resumeEnrollmentFromDelayJob } from "../_shared/omnichannelFlow/graphExecutor.ts";
import { omnichannelFlowCorsHeaders, omnichannelFlowJson } from "../_shared/omnichannelFlow/omnichannelFlowAuth.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: omnichannelFlowCorsHeaders });
  }

  if (req.method !== "POST") {
    return omnichannelFlowJson({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token || token !== serviceRoleKey) {
      return omnichannelFlowJson({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: jobs } = await admin
      .from("omnichannel_flow_delay_jobs")
      .select("id")
      .eq("status", "pending")
      .lte("resume_at", new Date().toISOString())
      .order("resume_at", { ascending: true })
      .limit(50);

    let processed = 0;
    for (const job of jobs ?? []) {
      const jobId = (job as { id: string }).id;
      await admin
        .from("omnichannel_flow_delay_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("status", "pending");

      try {
        await resumeEnrollmentFromDelayJob(admin, jobId);
        processed += 1;
      } catch (err) {
        console.error("delay job failed:", jobId, err);
        await admin
          .from("omnichannel_flow_delay_jobs")
          .update({
            status: "failed",
            error_message: String(err),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    }

    return omnichannelFlowJson({ ok: true, processed }, 200);
  } catch (err) {
    console.error("flow-delay-worker error:", err);
    return omnichannelFlowJson({ error: String(err) }, 500);
  }
});
