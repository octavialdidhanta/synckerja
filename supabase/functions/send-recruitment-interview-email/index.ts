/// <reference path="../deno-globals.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isInterviewScheduleComplete,
  sendRecruitmentInterviewEmailViaResend,
} from "../_shared/recruitmentInterviewEmail.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = {
  applicationId?: string;
};

function resolveAppOrigin(req: Request): string {
  const origin = req.headers.get("origin")?.trim();
  if (origin) return origin;

  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore
    }
  }

  return (Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "").trim()
    || "http://localhost:8080";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Server not configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const callerToken = authHeader.replace(/Bearer\s+/i, "");
    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAdmin.auth.getUser(callerToken);
    if (callerErr || !caller) {
      return json({ success: false, error: "Invalid session" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const applicationId = body.applicationId?.trim();
    if (!applicationId) {
      return json({ success: false, error: "applicationId is required" }, 400);
    }

    const { data: application, error: appError } = await supabaseAdmin
      .from("job_applications")
      .select(`
        id,
        applicant_name,
        applicant_email,
        recruitment_token,
        interview_date,
        interview_time,
        interview_location,
        interviewer_name,
        interview_notes,
        status,
        job_openings!inner (
          job_title,
          organization_id
        )
      `)
      .eq("id", applicationId)
      .maybeSingle();

    if (appError) {
      console.error("[send-recruitment-interview-email] load application failed", appError);
      return json({ success: false, error: "Failed to load application" }, 500);
    }

    if (!application) {
      return json({ success: false, error: "Application not found" }, 404);
    }

    const jobOpening = application.job_openings as {
      job_title?: string;
      organization_id?: string;
    } | null;
    const organizationId = jobOpening?.organization_id?.trim();
    if (!organizationId) {
      return json({ success: false, error: "Organization not found for application" }, 400);
    }

    const { data: callerRoleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    const callerRole = (callerRoleRow?.role ?? "").toString().trim().toLowerCase();
    if (!["owner", "admin", "hr"].includes(callerRole)) {
      return json({ success: false, error: "Insufficient permissions" }, 403);
    }

    if (!application.applicant_email?.trim()) {
      return json({ success: false, error: "No email address for this candidate" }, 400);
    }

    if (!isInterviewScheduleComplete(application)) {
      return json({
        success: false,
        error: "Interview date, time, and location are required before sending email",
      }, 400);
    }

    const { data: organization } = await supabaseAdmin
      .from("organizations")
      .select("company_name")
      .eq("id", organizationId)
      .maybeSingle();

    const sendResult = await sendRecruitmentInterviewEmailViaResend({
      applicantName: application.applicant_name,
      applicantEmail: application.applicant_email,
      positionTitle: jobOpening?.job_title || "the position",
      companyName: organization?.company_name ?? undefined,
      recruitmentToken: application.recruitment_token,
      interviewDate: application.interview_date,
      interviewTime: application.interview_time,
      interviewLocation: application.interview_location,
      interviewerName: application.interviewer_name,
      interviewNotes: application.interview_notes,
      origin: resolveAppOrigin(req),
    });

    if (!sendResult.ok) {
      return json({ success: false, error: sendResult.error ?? "Failed to send email" }, 502);
    }

    const { error: updateError } = await supabaseAdmin
      .from("job_applications")
      .update({ status: "contacted" })
      .eq("id", applicationId);

    if (updateError) {
      console.error("[send-recruitment-interview-email] status update failed", updateError);
    }

    return json({ success: true });
  } catch (e) {
    console.error("[send-recruitment-interview-email] error", e);
    return json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
