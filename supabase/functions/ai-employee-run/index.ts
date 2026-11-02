// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient Deno types for the editor
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authorizeCaller,
  buildSop2Prompt,
  interpretReserve,
  isDay,
  isUuid,
  jakartaToday,
  nextWeekDays,
  parsePlanDraft,
  projectRefFromUrl,
  publicModelFailure,
  resolvePostDate,
  scriptAiCall,
  secretMatches,
  signRunnerJwt,
  validatePlanDraft,
} from "../_shared/aiEmployee/planDraft.mjs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-synckerja-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "invalid_model_output"
    || message === "model_failed"
    || message === "reserve_failed"
    || message === "perform_failed"
    || message === "context_failed"
    || message === "reviewer_missing"
  ) return message;
  return "run_failed";
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const jwtSecret = Deno.env.get("AI_EMPLOYEE_JWT_SECRET") ?? "";
  const internalSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !jwtSecret || !internalSecret) {
    return json({ error: "misconfigured" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_input" }, 400);
  }

  const employeeId = String(body.employee_id ?? "").trim();
  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  const requestedDate = body.post_date == null || body.post_date === "" ? "" : String(body.post_date).trim();
  const today = jakartaToday();
  if (!isUuid(employeeId) || !instruction || instruction.length > 4000) return json({ error: "invalid_input" }, 400);
  if (requestedDate && (!isDay(requestedDate) || requestedDate < today)) return json({ error: "invalid_input" }, 400);
  if (body.dry_run != null && typeof body.dry_run !== "boolean") return json({ error: "invalid_input" }, 400);
  const dryRun = body.dry_run === true;

  const internalHeader = req.headers.get("x-synckerja-internal-secret");
  const internalHeaderPresent = internalHeader != null;
  const internalMatches = secretMatches(internalHeader ?? "", internalSecret);
  if (internalHeaderPresent && !internalMatches) return json({ error: "unauthorized" }, 401);

  const authorization = req.headers.get("Authorization") ?? "";
  const userToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const admin = createClient(supabaseUrl, serviceRoleKey);
  let userId: string | null = null;
  if (!internalHeaderPresent) {
    if (!userToken) return json({ error: "unauthorized" }, 401);
    const userResult = await admin.auth.getUser(userToken);
    userId = userResult.data.user?.id ?? null;
    if (!userId) return json({ error: "unauthorized" }, 401);
  }

  const employeeResult = await admin
    .from("employees")
    .select("id, organization_id, is_ai")
    .eq("id", employeeId)
    .maybeSingle();
  const employee = employeeResult.data;
  if (!employee?.organization_id || employee.is_ai !== true) return json({ error: "forbidden" }, 403);

  let roles: string[] = [];
  if (userId) {
    const roleResult = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", employee.organization_id);
    roles = (roleResult.data ?? []).map((row: { role?: string }) => String(row.role ?? ""));
  }

  const caller = authorizeCaller({
    internalHeaderPresent,
    internalMatches,
    userId,
    roles,
  });
  if (!caller.ok) return json({ error: caller.error }, caller.status);

  let modelUserId = caller.mode === "user" ? userId : null;
  if (!modelUserId) {
    const profileResult = await admin
      .from("ai_employee_profiles")
      .select("reviewer_employee_id")
      .eq("employee_id", employeeId)
      .maybeSingle();
    const reviewerId = profileResult.data?.reviewer_employee_id;
    if (!reviewerId) return json({ error: "reviewer_missing" }, 500);
    const reviewerResult = await admin
      .from("employees")
      .select("user_id")
      .eq("id", reviewerId)
      .maybeSingle();
    modelUserId = reviewerResult.data?.user_id ?? null;
    if (!modelUserId) return json({ error: "reviewer_missing" }, 500);
  }

  const runnerToken = await signRunnerJwt(jwtSecret, { ref: projectRefFromUrl(supabaseUrl) });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${runnerToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(args),
    });
    return { status: response.status, body: await readJson(response) };
  };

  let runId: string | null = null;
  let modelCalls = 0;
  let planId: string | null = null;
  let closed = false;
  const finish = async (status: "succeeded" | "failed" | "deferred", note = status) => {
    if (!runId || closed) return;
    const result = await rpc("ai_employee_run_finish", {
      p_employee_id: employeeId,
      p_run_id: runId,
      p_status: status,
      p_model_calls: modelCalls,
      p_plan_count: planId ? 1 : 0,
      p_object_ids: planId ? [planId] : null,
      p_note: note.slice(0, 200),
    });
    if (result.status < 200 || result.status >= 300) throw new Error("finish_failed");
    closed = true;
  };

  try {
    const started = await rpc("ai_employee_run_start", {
      p_employee_id: employeeId,
      p_sop_code: "SOP2",
    });
    runId = typeof started.body === "string" && isUuid(started.body) ? started.body : null;
    if (!runId) return json({ error: "run_start_failed" }, started.status === 401 ? 500 : 502);

    const context: Record<string, unknown[]> = {};
    for (const scope of ["pillars", "catalog", "thinking", "plans"]) {
      const loaded = await rpc("ai_employee_context", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_scope: scope,
        p_params: {},
      });
      const rows = loaded.body && typeof loaded.body === "object"
        ? (loaded.body as { rows?: unknown }).rows
        : null;
      if (loaded.status < 200 || loaded.status >= 300 || !Array.isArray(rows)) throw new Error("context_failed");
      context[scope] = rows;
    }
    if (context.pillars.length === 0) {
      await finish("failed");
      return json({ ok: false, error: "no_pillars", run_id: runId }, 422);
    }

    const reserved = await rpc("ai_employee_reserve_model_call", {
      p_employee_id: employeeId,
      p_run_id: runId,
      p_commit: true,
    });
    const reserveDecision = interpretReserve(reserved.status, reserved.body);
    if (reserveDecision.kind === "quota") {
      await finish("deferred");
      return json({ ok: false, status: "deferred", error: "quota_exceeded", run_id: runId }, 200);
    }
    if (reserveDecision.kind !== "ok") throw new Error("reserve_failed");
    modelCalls = 1;

    const allowedDates = requestedDate ? [requestedDate] : nextWeekDays(today);
    const prompt = buildSop2Prompt({
      instruction,
      today,
      allowedDates,
      postDate: requestedDate,
      pillars: context.pillars,
      catalog: context.catalog,
      thinking: context.thinking,
      plans: context.plans,
    });
    const modelCall = scriptAiCall({
      url: supabaseUrl,
      serviceRoleKey,
      anonKey,
      internalSecret,
      organizationId: employee.organization_id,
      userId: modelUserId,
      prompt,
    });
    const modelResponse = await fetch(modelCall.url, modelCall.init);
    const modelBody = await readJson(modelResponse) as { script?: unknown; error?: unknown; message?: unknown };
    if (!modelResponse.ok || typeof modelBody?.script !== "string") {
      const detail = publicModelFailure(modelResponse.status, modelBody);
      const note = `model_failed ${detail.status} ${detail.message}`.slice(0, 200);
      console.error("ai-employee-run model:", detail.status);
      await finish("failed", note);
      return json({
        ok: false,
        error: "model_failed",
        model_status: detail.status,
        model_error: detail.message,
        run_id: runId,
      }, 500);
    }

    const validated = validatePlanDraft(parsePlanDraft(modelBody.script), {
      pillars: context.pillars,
    });
    if (!validated.ok) throw new Error("invalid_model_output");
    const dated = resolvePostDate({
      today,
      requestedDate,
      modelDate: validated.plan.post_date,
      plans: context.plans,
    });
    if (!dated.ok) throw new Error("invalid_model_output");
    const plan = { ...validated.plan, post_date: dated.postDate };

    if (dryRun) {
      await finish("succeeded");
      return json({
        ok: true,
        dry_run: true,
        run_id: runId,
        model_calls: modelCalls,
        draft: plan,
      });
    }

    const performed = await rpc("ai_employee_perform", {
      p_employee_id: employeeId,
      p_run_id: runId,
      p_action: "content.plans.create",
      p_payload: plan,
    });
    const createdId = performed.body && typeof performed.body === "object"
      ? (performed.body as { id?: unknown }).id
      : null;
    if (performed.status < 200 || performed.status >= 300 || !isUuid(createdId)) throw new Error("perform_failed");
    planId = String(createdId);
    await finish("succeeded");
    return json({
      ok: true,
      dry_run: false,
      run_id: runId,
      plan_id: planId,
      model_calls: modelCalls,
      draft: plan,
    });
  } catch (error) {
    console.error("ai-employee-run:", publicError(error));
    if (runId && !closed) await finish("failed").catch(() => undefined);
    return json({ ok: false, error: publicError(error), run_id: runId }, 500);
  }
});
