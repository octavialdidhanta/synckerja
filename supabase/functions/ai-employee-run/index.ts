// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient Deno types for the editor
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  authorizeCaller,
  buildChatPrompt,
  buildSop1CheckPrompt,
  buildSop1Prompt,
  buildSop2Prompt,
  chooseSop1Pillar,
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
  nextWeekDays,
  openPlanDays,
  parseChatReply,
  parseExecutionCheck,
  parsePlanDraft,
  plansInRange,
  sop1CloseStatus,
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
  if (mode !== "plan" && mode !== "chat" && mode !== "sop1") return json({ error: "invalid_input" }, 400);
  const chat = mode === "chat";
  const sop1 = mode === "sop1";
  if (!isUuid(employeeId) || instruction.length > 4000 || (!sop1 && !instruction)) return json({ error: "invalid_input" }, 400);
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
  const planIds: string[] = [];
  let closed = false;
  const finish = async (status: "succeeded" | "failed" | "deferred" | "late", note = status) => {
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
    const started = await rpc("ai_employee_run_start", {
      p_employee_id: employeeId,
      p_sop_code: sop1 ? "SOP1" : chat ? "CHAT" : "SOP2",
    });
    runId = typeof started.body === "string" && isUuid(started.body) ? started.body : null;
    if (!runId) return json({ error: "run_start_failed" }, started.status === 401 ? 500 : 502);

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
      const prompt = buildChatPrompt({
        name: String(employee.full_name ?? ""),
        jobTitle: profileResult.data?.job_title ?? "",
        sops: sopResult.data ?? [],
        message: instruction,
        speaker,
        reviewerName,
        clock: chatClock,
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
      const scheduleResult = await admin
        .from("ai_employee_schedules")
        .select("weekday, due_local")
        .eq("employee_id", employeeId)
        .eq("organization_id", employee.organization_id)
        .eq("sop_code", "SOP1")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
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
      const closeSop1 = async (status: "succeeded" | "failed" | "deferred" | "late", label: string, openCount: number) => {
        const note = `sop1 ${label} steps=${steps.length} open=${openCount} plans=${planIds.length} calls=${modelCalls}`;
        await finish(status, note);
        await refreshKrs();
      };
      if (!sopResult.data?.id) {
        await closeSop1("failed", "sop_missing", 0);
        return json({ ok: false, error: "sop_missing", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }

      const windowDays = nextWeekDays(today);
      const bounds = fourWeekBounds(windowDays);
      if (!bounds) throw new Error("context_failed");
      const calendar = await loadScope("calendar", { from: bounds.start, to: bounds.end });
      const pillars = await loadScope("pillars", {});
      const catalog = await loadScope("catalog", {});
      const thinking = await loadScope("thinking", {});
      const feedback = await loadScope("feedback", {});
      const plans = calendar.slice();
      const open = openPlanDays(windowDays, plans);
      if (open.length === 0) {
        await closeSop1("succeeded", "window_full", 0);
        return json({ ok: true, mode: "sop1", status: "succeeded", run_id: runId, model_calls: 0, plan_count: 0, plan_ids: [] });
      }
      if (pillars.length === 0) {
        await closeSop1("failed", "no_pillars", open.length);
        return json({ ok: false, error: "no_pillars", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }

      const drafts: { title: string; post_date: string; brief: string; content_pillar_id: string }[] = [];
      let stop: "done" | "quota" | "pillar_cap" | "failed" = "done";
      let failure = { status: 0, message: "model_failed" };
      for (const day of open) {
        const choice = chooseSop1Pillar(pillars, plansInRange(plans, bounds.start, bounds.end));
        if (!choice) {
          stop = "pillar_cap";
          break;
        }
        const drafted = await withRetry(async () => {
          const result = await modelScript(buildSop1Prompt({ day, pillar: choice, steps, catalog, thinking, feedback, plans }));
          if (result.kind !== "ok") return result;
          const parsed = parsePlanDraft(result.script);
          if (parsed) {
            parsed.post_date = day;
            parsed.content_pillar_id = choice.id;
          }
          const validated = validatePlanDraft(parsed, { pillars });
          if (!validated.ok) return { kind: "failed", detail: { status: 0, message: "invalid_model_output" } };
          return { kind: "ok", script: JSON.stringify(validated.plan) };
        });
        if (drafted.kind === "quota") { stop = "quota"; break; }
        if (drafted.kind === "failed") { stop = "failed"; failure = drafted.detail; break; }
        const parsed = parsePlanDraft(drafted.script);
        if (!parsed) { stop = "failed"; failure = { status: 0, message: "invalid_model_output" }; break; }
        let plan = { ...parsed, post_date: day, content_pillar_id: choice.id };
        if (thinking.length > 0) {
          const judge = async (draft: typeof plan) => withRetry(async () => {
            const result = await modelScript(buildSop1CheckPrompt({ day, pillar: choice, draft }));
            if (result.kind !== "ok") return result;
            return parseExecutionCheck(result.script)
              ? { kind: "ok" as const, script: result.script }
              : { kind: "failed" as const, detail: { status: 0, message: "invalid_model_output" } };
          });
          let checked = await judge(plan);
          if (checked.kind === "quota") { stop = "quota"; break; }
          if (checked.kind === "failed") { stop = "failed"; failure = checked.detail; break; }
          if (parseExecutionCheck(checked.script)?.ok !== true) {
            const repaired = await withRetry(async () => {
              const result = await modelScript(buildSop1Prompt({ day, pillar: choice, steps, catalog, thinking, feedback, plans }));
              if (result.kind !== "ok") return result;
              const next = parsePlanDraft(result.script);
              if (next) {
                next.post_date = day;
                next.content_pillar_id = choice.id;
              }
              const validated = validatePlanDraft(next, { pillars });
              if (!validated.ok) return { kind: "failed" as const, detail: { status: 0, message: "invalid_model_output" } };
              return { kind: "ok" as const, script: JSON.stringify(validated.plan) };
            });
            if (repaired.kind === "quota") { stop = "quota"; break; }
            if (repaired.kind === "failed") { stop = "failed"; failure = repaired.detail; break; }
            const repairedPlan = parsePlanDraft(repaired.script);
            if (!repairedPlan) continue;
            plan = { ...repairedPlan, post_date: day, content_pillar_id: choice.id };
            checked = await judge(plan);
            if (checked.kind === "quota") { stop = "quota"; break; }
            if (checked.kind === "failed") { stop = "failed"; failure = checked.detail; break; }
            if (parseExecutionCheck(checked.script)?.ok !== true) continue;
          }
        }
        if (dryRun) {
          drafts.push(plan);
          plans.push({ post_date: day, content_pillar_id: choice.id });
          continue;
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
        planIds.push(String(createdId));
        plans.push({ post_date: day, content_pillar_id: choice.id });
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
      const clock = zonedClock(profileResult.data?.time_zone);
      const onTime = sop1CloseStatus({
        weekday: scheduleResult.data?.weekday,
        dueLocal: String(scheduleResult.data?.due_local ?? ""),
        clock,
      });
      const status = stop === "quota" ? "deferred" : onTime;
      const label = stop === "quota" ? "quota" : stop === "pillar_cap" ? "pillar_cap" : dryRun ? "dry_run" : "done";
      await closeSop1(status, label, open.length);
      return json({
        ok: status === "succeeded" || status === "late",
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
