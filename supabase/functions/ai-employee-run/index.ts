// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient Deno types for the editor
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authorizeCaller,
  buildChatPrompt,
  buildExecutionCheckPrompt,
  buildSop1Prompt,
  buildSop2Prompt,
  chooseBrandFocus,
  chooseProduct,
  chooseBriefProduct,
  chooseProductFields,
  chooseFocusedProductFields,
  judgeJobDesk,
  withJobClaim,
  chooseSop1Pillar,
  contentPlanDates,
  fourWeekBounds,
  greetingReply,
  isSimpleChatGreeting,
  politeAddress,
  readChatSpeaker,
  zonedClock,
  interpretReserve,
  isDay,
  isUuid,
  jakartaToday,
  nextMonthDays,
  nextWeekDays,
  parseCarouselDraft,
  parseChatReply,
  parseExecutionVerdict,
  pickUnusedIdea,
  parsePlanDraft,
  plansInRange,
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
  const mode = body.mode == null || body.mode === "" ? "plan" : String(body.mode);
  if (mode !== "plan" && mode !== "chat" && mode !== "sop1" && mode !== "sop3" && mode !== "job") return json({ error: "invalid_input" }, 400);
  const chat = mode === "chat";
  const sop1 = mode === "sop1";
  const sop3 = mode === "sop3";
  const jobMode = mode === "job";
  const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
  if (jobMode && (!isUuid(jobId) || body.dry_run === true)) return json({ error: "invalid_input" }, 400);
  if (!isUuid(employeeId) || instruction.length > 4000 || (!sop1 && !jobMode && !instruction)) return json({ error: "invalid_input" }, 400);
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
    .select("id, organization_id, is_ai, full_name")
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
  let workInstruction = instruction;
  let jobTaken = false;
  let claimToken: string | null = null;
  let jobClosed = false;
  let jobSource: string | null = null;
  let jobPlanId: string | null = null;
  let jobText = "";
  let jobDoneRevisions = 0;
  const planIds: string[] = [];
  let closed = false;
  const finish = async (status: "succeeded" | "failed" | "deferred" | "late", note: string = status) => {
    if (!runId || closed) return;
    const ids = planIds.length > 0 ? planIds : planId ? [planId] : [];
    const result = await rpc("ai_employee_run_finish", {
      p_employee_id: employeeId,
      p_run_id: runId,
      p_status: status,
      p_model_calls: modelCalls,
      p_plan_count: ids.length,
      p_object_ids: ids.length > 0 ? ids : null,
      p_note: note.slice(0, 200),
    });
    if (result.status < 200 || result.status >= 300) throw new Error("finish_failed");
    closed = true;
  };
  const closeJob = async (
    status: "done" | "failed" | "rejected" | "deferred",
    reason = "",
    savedPlan: string | null = null,
    title = "",
    brief = "",
  ) => {
    if (!jobTaken || jobClosed || !jobId) return;
    jobClosed = true;
    const result = await rpc("ai_employee_job_finish", {
      p_employee_id: employeeId,
      p_job_id: jobId,
      p_run_id: runId,
      p_status: status,
      p_reason: reason.slice(0, 500),
      p_plan_id: savedPlan,
      p_title: title.slice(0, 200),
      p_brief: brief.slice(0, 8000),
      p_claim_token: claimToken,
    });
    if (result.status < 200 || result.status >= 300) throw new Error("job_finish_failed");
  };

  let chatClock = zonedClock("Asia/Jakarta");
  if (chat) {
    const zoneResult = await admin
      .from("ai_employee_profiles")
      .select("time_zone")
      .eq("employee_id", employeeId)
      .eq("organization_id", employee.organization_id)
      .maybeSingle();
    if (!zoneResult.error) chatClock = zonedClock(zoneResult.data?.time_zone);
    if (isSimpleChatGreeting(instruction, String(employee.full_name ?? ""))) {
      const known = readChatSpeaker(body.speaker);
      const address = known?.address || politeAddress(known?.name ?? "", known?.role ?? "");
      return json({
        ok: true,
        mode: "chat",
        model_calls: 0,
        name: String(employee.full_name ?? ""),
        reply: greetingReply(String(employee.full_name ?? ""), address, chatClock),
      });
    }
  }

  try {
    if (jobMode) {
      const taken = await rpc("ai_employee_job_take", {
        p_employee_id: employeeId,
        p_job_id: jobId,
      });
      const row = taken.body && typeof taken.body === "object" ? taken.body as Record<string, unknown> : null;
      const source = row ? String(row.source ?? "") : "";
      const takenToken = row?.claim_token;
      if (
        taken.status < 200 || taken.status >= 300
        || (source !== "task" && source !== "revision")
        || typeof takenToken !== "string"
        || !isUuid(takenToken)
      ) {
        return json({ ok: false, error: "job_not_claimed", run_id: null }, 409);
      }
      claimToken = takenToken;
      jobTaken = true;
      jobSource = source;
      jobPlanId = typeof row?.plan_id === "string" ? row.plan_id : null;
      jobDoneRevisions = Number(row?.done_revisions ?? 0);
      const title = String(row?.task_title ?? row?.plan_title ?? "");
      const description = String(row?.task_description ?? "");
      const reason = String(row?.reason ?? "");
      const planBrief = String(row?.plan_brief ?? "");
      jobText = source === "revision"
        ? `Revisi plan.\nJudul: ${title}\nBrief sekarang:\n${planBrief}\nAlasan penolakan: ${reason}`
        : `${title}\n${description}`.trim();
    }

    const started = await rpc("ai_employee_run_start", {
      p_employee_id: employeeId,
      p_sop_code: sop1 ? "SOP1" : chat ? "CHAT" : (sop3 || jobSource === "revision") ? "SOP3" : "SOP2",
    });
    runId = typeof started.body === "string" && isUuid(started.body) ? started.body : null;
    if (!runId) {
      if (jobTaken) await closeJob("failed", "run_start_failed").catch(() => undefined);
      return json({ error: "run_start_failed" }, started.status === 401 ? 500 : 502);
    }

    if (jobMode) {
      const bound = await rpc("ai_employee_job_bind", {
        p_employee_id: employeeId,
        p_job_id: jobId,
        p_run_id: runId,
        p_claim_token: claimToken,
      });
      if (bound.status < 200 || bound.status >= 300) {
        await closeJob("failed", "job_bind_failed").catch(() => undefined);
        await finish("failed", "job_bind_failed").catch(() => undefined);
        return json({ ok: false, error: "job_bind_failed", run_id: runId }, 409);
      }
      if (jobSource === "task") {
        const desk = judgeJobDesk(jobText);
        if (!desk.ok) {
          await closeJob("rejected", desk.reason);
          await finish("failed", "outside_job_desk");
          return json({
            ok: false,
            error: "outside_job_desk",
            reason: desk.reason,
            run_id: runId,
            model_calls: 0,
          }, 200);
        }
      }
      if (jobSource === "revision" && jobDoneRevisions >= 2) {
        await closeJob("rejected", "Revisi sudah 2 kali. Plan kembali ke reviewer.");
        await finish("failed", "revision_limit");
        return json({ ok: false, error: "revision_limit", run_id: runId, model_calls: 0 }, 200);
      }
      workInstruction = jobText.slice(0, 4000);
    }

    const loadProduct = async () => {
      const loaded = await rpc("ai_employee_context", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_scope: "product",
        p_params: {},
      });
      const detail = JSON.stringify(loaded.body ?? "");
      if (loaded.status < 200 || loaded.status >= 300) {
        if (detail.includes("scope_forbidden")) return [];
        throw new Error("context_failed");
      }
      const rows = loaded.body && typeof loaded.body === "object" ? (loaded.body as { rows?: unknown }).rows : null;
      if (!Array.isArray(rows)) throw new Error("context_failed");
      return rows as Record<string, unknown>[];
    };

    if (chat) {
      const profileResult = await admin
        .from("ai_employee_profiles")
        .select("job_title, reviewer_employee_id")
        .eq("employee_id", employeeId)
        .eq("organization_id", employee.organization_id)
        .maybeSingle();
      const sopResult = await admin
        .from("ai_employee_sops")
        .select("code, title")
        .eq("employee_id", employeeId)
        .eq("organization_id", employee.organization_id)
        .eq("is_current", true);
      if (profileResult.error || sopResult.error) throw new Error("context_failed");
      let reviewerName = "";
      const reviewerId = profileResult.data?.reviewer_employee_id;
      if (reviewerId) {
        const reviewerResult = await admin
          .from("employees")
          .select("full_name, user_id")
          .eq("id", reviewerId)
          .eq("organization_id", employee.organization_id)
          .maybeSingle();
        if (reviewerResult.error) throw new Error("context_failed");
        reviewerName = String(reviewerResult.data?.full_name ?? "");
        if (reviewerResult.data?.user_id) {
          const reviewerRoles = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", reviewerResult.data.user_id)
            .eq("organization_id", employee.organization_id);
          if (reviewerRoles.error) throw new Error("context_failed");
          const reviewerIsOwner = (reviewerRoles.data ?? []).some((row: { role?: string }) => String(row.role ?? "").trim().toLowerCase() === "owner");
          if (reviewerIsOwner) reviewerName = politeAddress(reviewerName, "owner") || reviewerName;
        }
      }
      let speaker = internalHeaderPresent ? readChatSpeaker(body.speaker) : null;
      if (!speaker && userId) {
        const callerProfile = await admin.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
        const callerEmployee = await admin
          .from("employees")
          .select("id")
          .eq("user_id", userId)
          .eq("organization_id", employee.organization_id)
          .maybeSingle();
        if (callerProfile.error || callerEmployee.error) throw new Error("context_failed");
        const callerRole = roles.some((role) => role.trim().toLowerCase() === "owner")
          ? "owner"
          : roles.some((role) => role.trim().toLowerCase() === "admin")
            ? "admin"
            : "member";
        const callerName = String(callerProfile.data?.full_name ?? "");
        speaker = {
          name: callerName,
          role: callerRole,
          address: politeAddress(callerName, callerRole),
          isReviewer: Boolean(callerEmployee.data?.id && callerEmployee.data.id === reviewerId),
        };
      }
      const reserved = await rpc("ai_employee_reserve_model_call", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_commit: true,
      });
      const reserveDecision = interpretReserve(reserved.status, reserved.body);
      if (reserveDecision.kind === "quota") {
        await finish("deferred");
        return json({ ok: false, status: "deferred", error: "quota_exceeded", run_id: runId, mode: "chat" }, 200);
      }
      if (reserveDecision.kind !== "ok") throw new Error("reserve_failed");
      modelCalls = 1;
      const briefLoaded = await rpc("ai_employee_context", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_scope: "brief",
        p_params: {},
      });
      const briefRows = briefLoaded.body && typeof briefLoaded.body === "object"
        ? (briefLoaded.body as { rows?: unknown }).rows
        : null;
      if (briefLoaded.status < 200 || briefLoaded.status >= 300 || !Array.isArray(briefRows)) throw new Error("context_failed");
      const product = await loadProduct();
      const prompt = buildChatPrompt({
        name: String(employee.full_name ?? ""),
        jobTitle: profileResult.data?.job_title ?? "",
        sops: sopResult.data ?? [],
        message: instruction,
        speaker,
        reviewerName,
        clock: chatClock,
        brief: briefRows[0] ?? null,
        product,
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
        console.error("ai-employee-run chat:", detail.status);
        await finish("failed", note);
        return json({
          ok: false,
          error: "model_failed",
          mode: "chat",
          model_status: detail.status,
          model_error: detail.message,
          run_id: runId,
        }, 500);
      }
      const reply = parseChatReply(modelBody.script);
      if (!reply) throw new Error("invalid_model_output");
      await finish("succeeded", "chat");
      return json({
        ok: true,
        mode: "chat",
        run_id: runId,
        model_calls: modelCalls,
        name: String(employee.full_name ?? ""),
        reply,
      });
    }

    if (sop1) {
      type ModelResult =
        | { kind: "ok"; script: string }
        | { kind: "quota" }
        | { kind: "failed"; detail: { status: number; message: string } };
      const rowsOf = (value: unknown): Record<string, unknown>[] => {
        const rows = value && typeof value === "object" ? (value as { rows?: unknown }).rows : null;
        return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
      };
      const loadScope = async (scope: string, params: Record<string, string>) => {
        const loaded = await rpc("ai_employee_context", {
          p_employee_id: employeeId,
          p_run_id: runId,
          p_scope: scope,
          p_params: params,
        });
        if (loaded.status < 200 || loaded.status >= 300) throw new Error("context_failed");
        return rowsOf(loaded.body);
      };
      const modelScript = async (prompt: string): Promise<ModelResult> => {
        const reserved = await rpc("ai_employee_reserve_model_call", {
          p_employee_id: employeeId,
          p_run_id: runId,
          p_commit: true,
        });
        const decision = interpretReserve(reserved.status, reserved.body);
        if (decision.kind === "quota") return { kind: "quota" };
        if (decision.kind !== "ok") return { kind: "failed", detail: { status: reserved.status, message: "reserve_failed" } };
        modelCalls += 1;
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
        const modelBody = await readJson(modelResponse) as { script?: unknown };
        if (modelResponse.ok && typeof modelBody?.script === "string") return { kind: "ok", script: modelBody.script };
        return { kind: "failed", detail: publicModelFailure(modelResponse.status, modelBody) };
      };
      const withRetry = async (run: () => Promise<ModelResult>): Promise<ModelResult> => {
        const first = await run();
        if (first.kind !== "failed") return first;
        return run();
      };

      const sopResult = await admin
        .from("ai_employee_sops")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("organization_id", employee.organization_id)
        .eq("code", "SOP1")
        .eq("is_current", true)
        .maybeSingle();
      const profileResult = await admin
        .from("ai_employee_profiles")
        .select("time_zone")
        .eq("employee_id", employeeId)
        .eq("organization_id", employee.organization_id)
        .maybeSingle();
      const scheduleId = typeof body.schedule_id === "string" ? body.schedule_id.trim() : "";
      let scheduleQuery = admin
        .from("ai_employee_schedules")
        .select("id, cadence, plan_count")
        .eq("employee_id", employeeId)
        .eq("organization_id", employee.organization_id)
        .eq("sop_code", "SOP1");
      scheduleQuery = isUuid(scheduleId)
        ? scheduleQuery.eq("id", scheduleId)
        : scheduleQuery.eq("is_active", true).order("next_run_at", { ascending: true }).limit(1);
      const scheduleResult = await scheduleQuery.maybeSingle();
      if (sopResult.error || profileResult.error || scheduleResult.error) throw new Error("context_failed");
      const stepResult = sopResult.data?.id
        ? await admin
          .from("ai_employee_sop_steps")
          .select("step_no, instruction")
          .eq("sop_id", sopResult.data.id)
          .order("step_no")
        : { data: [], error: null };
      if (stepResult.error) throw new Error("context_failed");
      const steps = stepResult.data ?? [];
      const refreshKrs = async () => {
        const result = await rpc("ai_employee_refresh_krs", { p_employee_id: employeeId });
        if (result.status < 200 || result.status >= 300) console.error("ai-employee-run kr:", result.status);
      };
      let lastReject = "";
      const closeSop1 = async (status: "succeeded" | "failed" | "deferred" | "late", label: string, openCount: number) => {
        const note = `sop1 ${label} steps=${steps.length} open=${openCount} plans=${planIds.length} calls=${modelCalls}${lastReject ? ` reject=${lastReject}` : ""}`;
        await finish(status, note);
        await refreshKrs();
      };
      if (!sopResult.data?.id) {
        await closeSop1("failed", "sop_missing", 0);
        return json({ ok: false, error: "sop_missing", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }

      const sopClock = zonedClock(profileResult.data?.time_zone);
      const sopToday = sopClock.date;
      const span = [...new Set([sopToday, ...nextWeekDays(sopToday), ...nextMonthDays(sopToday)])].sort();
      const bounds = fourWeekBounds(span);
      if (!bounds) throw new Error("context_failed");
      const calendar = await loadScope("calendar", { from: bounds.start, to: bounds.end });
      const nayaPlans = await loadScope("plans", { from: bounds.start, to: bounds.end });
      const pillarRows = await loadScope("pillars", {});
      const catalog = await loadScope("catalog", {});
      const thinking = await loadScope("thinking", {});
      const feedback = await loadScope("feedback", {});
      const briefRows = await loadScope("brief", {});
      const performance = await loadScope("performance", {});
      const product = await loadProduct();
      const brief = briefRows[0] ?? null;
      const serviceIds = Array.isArray(brief?.service_ids) ? brief.service_ids : [];
      if (serviceIds.length === 0) {
        await closeSop1("failed", "brief_missing", 0);
        return json({ ok: false, error: "brief_missing", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }
      const preferredPillars = new Set(Array.isArray(brief?.pillar_ids) ? brief.pillar_ids.filter((id: unknown) => typeof id === "string") : []);
      const pillars = preferredPillars.size > 0
        ? pillarRows.filter((row) => preferredPillars.has(String(row.id ?? "")))
        : pillarRows;
      if (!scheduleResult.data) {
        await closeSop1("failed", "schedule_missing", 0);
        return json({ ok: false, error: "schedule_missing", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }
      const open = contentPlanDates({
        cadence: String(scheduleResult.data.cadence ?? ""),
        today: sopToday,
        frequency: Number(scheduleResult.data.plan_count ?? 1),
        plans: calendar,
      });
      const angleIds = Array.isArray(brief?.angle_ids)
        ? brief.angle_ids.filter((id: unknown) => typeof id === "string" && id)
        : [];
      const focused = angleIds.length > 0;
      const carouselPaths = focused ? await loadScope("carousel_paths", {}) : [];
      if (focused) {
        for (const path of carouselPaths) {
          const id = String(path.content_pillar_id ?? "");
          if (id && !pillars.some((row) => String(row.id ?? "") === id)) {
            pillars.push({ id, name: String(path.pillar_name ?? "") });
          }
        }
      }
      if (open.length === 0) {
        await closeSop1("succeeded", "target_met", 0);
        return json({ ok: true, mode: "sop1", status: "succeeded", run_id: runId, model_calls: 0, plan_count: 0, plan_ids: [] });
      }
      if (focused ? carouselPaths.length === 0 : !pickUnusedIdea(thinking)) {
        await closeSop1("succeeded", "no_idea", open.length);
        return json({ ok: true, mode: "sop1", status: "succeeded", run_id: runId, model_calls: 0, plan_count: 0, plan_ids: [] });
      }
      if (!focused && pillars.length === 0) {
        await closeSop1("failed", "no_pillars", open.length);
        return json({ ok: false, error: "no_pillars", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }

      const drafts: { title: string; post_date: string; brief: string; caption: string; content_pillar_id: string }[] = [];
      let stop: "done" | "quota" | "pillar_cap" | "failed" | "ideas_exhausted" = "done";
      let failure = { status: 0, message: "model_failed" };
      let dayIndex = 0;
      while (dayIndex < open.length && stop === "done") {
        const day = open[dayIndex];
        const path = focused
          ? carouselPaths.find((row) => row.used !== true && row.skip !== true) ?? null
          : null;
        const idea = focused ? path : pickUnusedIdea(thinking);
        if (!idea) {
          stop = "ideas_exhausted";
          break;
        }
        const choice = focused
          ? { id: String(path?.content_pillar_id ?? ""), name: String(path?.pillar_name ?? ""), capped: false }
          : chooseSop1Pillar(pillars, plansInRange(nayaPlans, bounds.start, bounds.end));
        if (!choice?.id) {
          stop = "pillar_cap";
          break;
        }
        const promptBrief = focused
          ? { ...brief, voice: String(path?.prompt_voice ?? brief?.voice ?? "") }
          : brief;
        const promptPath = focused ? path : null;
        const service = chooseBrandFocus({ brief, catalog, dayIndex, allowOverride: false });
        if (!service) {
          stop = "failed";
          failure = { status: 0, message: "brief_missing" };
          break;
        }
        const drafted = await withRetry(async () => {
          const result = await modelScript(buildSop1Prompt({ day, pillar: choice, steps, catalog, thinking, feedback, plans: calendar, brief: promptBrief, performance, service, idea, product, path: promptPath }));
          if (result.kind !== "ok") return result;
          const parsed = parseCarouselDraft(result.script);
          if (!parsed || !pillars.some((row) => String(row.id ?? "") === choice.id)) {
            return { kind: "failed", detail: { status: 0, message: "invalid_model_output" } };
          }
          parsed.post_date = day;
          parsed.content_pillar_id = choice.id;
          return { kind: "ok", script: JSON.stringify(parsed) };
        });
        if (drafted.kind === "quota") { stop = "quota"; break; }
        if (drafted.kind === "failed") {
          if (drafted.detail.message !== "invalid_model_output") {
            stop = "failed";
            failure = drafted.detail;
            break;
          }
          idea.skip = true;
          continue;
        }
        const parsed = parseCarouselDraft(drafted.script);
        if (!parsed) { idea.skip = true; continue; }
        let plan = { ...parsed, post_date: day, content_pillar_id: choice.id, service_id: service.id };
        let executionId: string | null = null;
        if (idea) {
          const judge = async (draft: typeof plan) => withRetry(async () => {
            const result = await modelScript(buildExecutionCheckPrompt({ day, pillar: choice, idea, draft }));
            if (result.kind !== "ok") return result;
            return parseExecutionVerdict(result.script)
              ? { kind: "ok" as const, script: result.script }
              : { kind: "failed" as const, detail: { status: 0, message: "invalid_model_output" } };
          });
          let checked = await judge(plan);
          if (checked.kind === "quota") { stop = "quota"; break; }
          if (checked.kind === "failed") {
            if (checked.detail.message !== "invalid_model_output") {
              stop = "failed";
              failure = checked.detail;
              break;
            }
            idea.skip = true;
            continue;
          }
          if (parseExecutionVerdict(checked.script)?.ok !== true) {
            lastReject = String(parseExecutionVerdict(checked.script)?.check_id ?? "unparsed").slice(0, 40);
            const repaired = await withRetry(async () => {
              const result = await modelScript(buildSop1Prompt({ day, pillar: choice, steps, catalog, thinking, feedback, plans: calendar, brief: promptBrief, performance, service, idea, product, path: promptPath }));
              if (result.kind !== "ok") return result;
              const next = parseCarouselDraft(result.script);
              if (!next) return { kind: "failed" as const, detail: { status: 0, message: "invalid_model_output" } };
              next.post_date = day;
              next.content_pillar_id = choice.id;
              return { kind: "ok" as const, script: JSON.stringify(next) };
            });
            if (repaired.kind === "quota") { stop = "quota"; break; }
            if (repaired.kind === "failed") {
              if (repaired.detail.message !== "invalid_model_output") {
                stop = "failed";
                failure = repaired.detail;
                break;
              }
              idea.skip = true;
              continue;
            }
            const repairedPlan = parseCarouselDraft(repaired.script);
            if (!repairedPlan) { idea.skip = true; continue; }
            plan = { ...repairedPlan, post_date: day, content_pillar_id: choice.id, service_id: service.id };
            checked = await judge(plan);
            if (checked.kind === "quota") { stop = "quota"; break; }
            if (checked.kind === "failed") {
              if (checked.detail.message !== "invalid_model_output") {
                stop = "failed";
                failure = checked.detail;
                break;
              }
              idea.skip = true;
              continue;
            }
            if (parseExecutionVerdict(checked.script)?.ok !== true) {
              lastReject = String(parseExecutionVerdict(checked.script)?.check_id ?? "unparsed").slice(0, 40);
              idea.skip = true;
              continue;
            }
          }
          const verdict = parseExecutionVerdict(checked.script);
          if (!verdict?.ok) {
            lastReject = String(verdict?.check_id ?? "unparsed").slice(0, 40);
            idea.skip = true;
            continue;
          }
          if (!dryRun) {
            const judged = await rpc("ai_employee_perform", {
              p_employee_id: employeeId,
              p_run_id: runId,
              p_action: "thinking.execution.check",
              p_payload: withJobClaim({
                idea_id: String(idea.idea_id ?? idea.id ?? ""),
                content_pillar_id: choice.id,
                statement: verdict.statement,
                checks: verdict.checks,
                facts: verdict.facts,
                script: verdict.script,
              }, claimToken),
            });
            const accepted = judged.body && typeof judged.body === "object"
              ? (judged.body as { accepted?: unknown; execution_id?: unknown; check_id?: unknown })
              : null;
            if (judged.status < 200 || judged.status >= 300 || accepted?.accepted !== true || !isUuid(accepted.execution_id)) {
              const rejected = accepted && typeof accepted.check_id === "string" ? accepted.check_id : "db";
              lastReject = rejected.slice(0, 40);
              idea.skip = true;
              continue;
            }
            executionId = String(accepted.execution_id);
          }
        }
        const productId = focused
          ? chooseBriefProduct(product, plan.product_knowledge_id)
          : chooseProduct(product, plan.product_knowledge_id);
        const chosenProduct = productId ? product.find((row) => row.id === productId) : undefined;
        plan.product_knowledge_id = productId;
        plan.product_knowledge_fields = focused
          ? chooseFocusedProductFields(plan.product_knowledge_fields, chosenProduct)
          : chooseProductFields(plan.product_knowledge_fields, chosenProduct);
        const takeProduct = () => {
          if (!productId) return;
          const row = product.find((item) => item.id === productId);
          if (row) row.unused = false;
        };
        if (dryRun) {
          takeProduct();
          idea.used = true;
          drafts.push(plan);
          calendar.push({ post_date: day, content_pillar_id: choice.id });
          nayaPlans.push({ post_date: day, content_pillar_id: choice.id, author_employee_id: employeeId });
          dayIndex += 1;
          continue;
        }
        const performed = await rpc("ai_employee_perform", {
          p_employee_id: employeeId,
          p_run_id: runId,
          p_action: "thinking.plan.save",
          p_payload: withJobClaim({
            ...plan,
            idea_id: String(idea.idea_id ?? idea.id ?? ""),
            execution_id: executionId,
            ...(focused ? {
              path_pillar_id: String(path?.content_pillar_id ?? ""),
              delivery_voice: path?.delivery_voice == null ? "" : String(path.delivery_voice),
            } : {}),
          }, claimToken),
        });
        const createdId = performed.body && typeof performed.body === "object"
          ? (performed.body as { id?: unknown }).id
          : null;
        const performMessage = performed.body && typeof performed.body === "object" && "message" in performed.body
          ? String((performed.body as { message?: unknown }).message ?? "")
          : "";
        if (focused && performMessage.includes("path_not_allowed")) {
          idea.skip = true;
          continue;
        }
        if (performed.status < 200 || performed.status >= 300 || !isUuid(createdId)) throw new Error("perform_failed");
        takeProduct();
        idea.used = true;
        planIds.push(String(createdId));
        calendar.push({ post_date: day, content_pillar_id: choice.id });
        nayaPlans.push({ post_date: day, content_pillar_id: choice.id, author_employee_id: employeeId });
        dayIndex += 1;
      }

      if (stop === "failed") {
        await closeSop1("failed", "model_failed", open.length);
        return json({
          ok: false,
          error: "model_failed",
          mode: "sop1",
          model_status: failure.status,
          model_error: failure.message,
          run_id: runId,
          plan_count: planIds.length,
          plan_ids: planIds,
          model_calls: modelCalls,
        }, 500);
      }
      const status = stop === "quota" ? "deferred" : "succeeded";
      const savedCount = dryRun ? drafts.length : planIds.length;
      const label = stop === "quota"
        ? "quota"
        : stop === "pillar_cap"
          ? "pillar_cap"
          : stop === "ideas_exhausted"
            ? (savedCount === 0 ? "checks_failed" : "ideas_exhausted")
            : dryRun
              ? "dry_run"
              : "done";
      await closeSop1(status, label, open.length);
      return json({
        ok: status === "succeeded",
        mode: "sop1",
        status,
        dry_run: dryRun,
        run_id: runId,
        model_calls: modelCalls,
        plan_count: dryRun ? drafts.length : planIds.length,
        plan_ids: planIds,
        drafts: dryRun ? drafts : undefined,
      });
    }

    const context: Record<string, unknown[]> = {};
    for (const scope of ["pillars", "catalog", "thinking", "plans", "brief", "performance"]) {
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
      if (jobTaken) await closeJob("failed", "no_pillars");
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
      if (jobTaken) await closeJob("deferred", "Kuota model habis.");
      await finish("deferred");
      return json({ ok: false, status: "deferred", error: "quota_exceeded", run_id: runId }, 200);
    }
    if (reserveDecision.kind !== "ok") throw new Error("reserve_failed");
    modelCalls = 1;

    const allowedDates = requestedDate ? [requestedDate] : nextWeekDays(today);
    const brief = (context.brief?.[0] ?? null) as { service_ids?: unknown; angle_ids?: unknown } | null;
    const serviceIds = Array.isArray(brief?.service_ids) ? brief.service_ids : [];
    const angleIds = Array.isArray(brief?.angle_ids)
      ? brief.angle_ids.filter((id: unknown) => typeof id === "string" && id)
      : [];
    const thinkingForJob = angleIds.length > 0
      ? context.thinking.filter((row) => angleIds.includes(String((row as { angle_id?: unknown }).angle_id ?? "")))
      : context.thinking;
    const service = serviceIds.length === 0
      ? null
      : chooseBrandFocus({
        brief,
        catalog: context.catalog,
        dayIndex: 0,
        instruction: workInstruction,
        allowOverride: true,
      });
    if (serviceIds.length > 0 && !service) throw new Error("brief_missing");
    const idea = pickUnusedIdea(thinkingForJob);
    const product = await loadProduct();
    const prompt = buildSop2Prompt({
      instruction: workInstruction,
      today,
      allowedDates,
      postDate: requestedDate,
      pillars: context.pillars,
      catalog: context.catalog,
      thinking: thinkingForJob,
      plans: context.plans,
      brief,
      performance: context.performance,
      service,
      product,
      revision: sop3,
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
      if (jobTaken) await closeJob("failed", note);
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
    const productId = angleIds.length > 0
      ? chooseBriefProduct(product, validated.plan.product_knowledge_id)
      : chooseProduct(product, validated.plan.product_knowledge_id);
    const chosen = productId ? product.find((row) => row.id === productId) : undefined;
    const plan = {
      ...validated.plan,
      post_date: dated.postDate,
      service_id: service?.id ?? null,
      product_knowledge_id: productId,
      product_knowledge_fields: angleIds.length > 0
        ? chooseFocusedProductFields(validated.plan.product_knowledge_fields, chosen)
        : chooseProductFields(validated.plan.product_knowledge_fields, chosen),
    };

    if (jobSource === "revision") {
      await closeJob("done", "", jobPlanId, String(plan.title ?? ""), String(plan.brief ?? ""));
      planId = jobPlanId;
      await finish("succeeded");
      return json({
        ok: true,
        mode: "job",
        source: "revision",
        dry_run: false,
        run_id: runId,
        plan_id: planId,
        model_calls: modelCalls,
        draft: plan,
      });
    }

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

    let executionId: string | null = null;
    if (idea) {
      const reservedCheck = await rpc("ai_employee_reserve_model_call", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_commit: true,
      });
      const checkDecision = interpretReserve(reservedCheck.status, reservedCheck.body);
      if (checkDecision.kind === "quota") {
        if (jobTaken) await closeJob("deferred", "Kuota model habis.");
        await finish("deferred");
        return json({ ok: false, status: "deferred", error: "quota_exceeded", run_id: runId }, 200);
      }
      if (checkDecision.kind !== "ok") throw new Error("reserve_failed");
      modelCalls += 1;
      const checkCall = scriptAiCall({
        url: supabaseUrl,
        serviceRoleKey,
        anonKey,
        internalSecret,
        organizationId: employee.organization_id,
        userId: modelUserId,
        prompt: buildExecutionCheckPrompt({
          day: plan.post_date,
          pillar: { id: plan.content_pillar_id },
          idea,
          draft: plan,
        }),
      });
      const checkResponse = await fetch(checkCall.url, checkCall.init);
      const checkBody = await readJson(checkResponse) as { script?: unknown };
      const verdict = checkResponse.ok && typeof checkBody?.script === "string"
        ? parseExecutionVerdict(checkBody.script)
        : null;
      if (!verdict?.ok) throw new Error("invalid_model_output");
      const judged = await rpc("ai_employee_perform", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_action: "thinking.execution.check",
        p_payload: withJobClaim({
          idea_id: String(idea.idea_id ?? idea.id ?? ""),
          content_pillar_id: plan.content_pillar_id,
          statement: verdict.statement,
          checks: verdict.checks,
          facts: verdict.facts,
          script: verdict.script,
        }, claimToken),
      });
      const accepted = judged.body && typeof judged.body === "object"
        ? (judged.body as { accepted?: unknown; execution_id?: unknown })
        : null;
      if (judged.status < 200 || judged.status >= 300 || accepted?.accepted !== true || !isUuid(accepted.execution_id)) {
        throw new Error("execution_rejected");
      }
      executionId = String(accepted.execution_id);
      idea.used = true;
    }
    const performed = await rpc("ai_employee_perform", {
      p_employee_id: employeeId,
      p_run_id: runId,
      p_action: idea ? "thinking.plan.save" : "content.plans.create",
      p_payload: withJobClaim(idea
        ? { ...plan, idea_id: String(idea.idea_id ?? idea.id ?? ""), execution_id: executionId }
        : plan, claimToken),
    });
    const createdId = performed.body && typeof performed.body === "object"
      ? (performed.body as { id?: unknown }).id
      : null;
    if (performed.status < 200 || performed.status >= 300 || !isUuid(createdId)) throw new Error("perform_failed");
    planId = String(createdId);
    if (jobMode) await closeJob("done", "", planId, String(plan.title ?? ""), String(plan.brief ?? ""));
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
    if (jobTaken && !jobClosed) await closeJob("failed", publicError(error)).catch(() => undefined);
    if (runId && !closed) await finish("failed").catch(() => undefined);
    return json({ ok: false, error: publicError(error), run_id: runId }, 500);
  }
});
