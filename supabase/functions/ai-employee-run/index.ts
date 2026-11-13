// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- ambient Deno types for the editor
/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { carouselSlidesFromBrief } from "../_shared/canvaCarouselBrief.ts";
import {
  authorizeCaller,
  buildChatPrompt,
  buildExecutionCheckPrompt,
  buildSop1Prompt,
  buildSop2Prompt,
  catalogChoice,
  chooseBrandFocus,
  chooseProduct,
  chooseBriefProduct,
  chooseProductFields,
  chooseFocusedProductFields,
  judgeJobDesk,
  withJobClaim,
  chooseContentTurn,
  dailySlotIndex,
  manualCatalogIndex,
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
  catalogPalette,
  carouselReferenceOk,
  normalizeCarouselReference,
  parseCarouselDraft,
  pickMenuIds,
  referencePositions,
  rotateReference,
  briefWithReference,
  parseChatReply,
  parseExecutionVerdict,
  copyClaimTokens,
  copyCollides,
  copyFingerprint,
  hookFromElement,
  headlineFromElement,
  headlineRepeats,
  openingStyleFor,
  orderCopyFallbackPaths,
  selectCopyPriors,
  pickUnusedIdea,
  appendCarouselDevelopmentPath,
  buildCarouselPathCheckPrompt,
  buildCarouselPathPrompt,
  carouselDevelopmentPath,
  parseCarouselPathCheck,
  parseCarouselPathReviews,
  rankPillarsForRotation,
  parsePlanDraft,
  projectRefFromUrl,
  publicModelFailure,
  resolvePostDate,
  scriptAiCall,
  secretMatches,
  signRunnerJwt,
  validatePlanDraft,
} from "../_shared/aiEmployee/planDraft.mjs";

/** Extra carousel paths a focused run may build after every queued path was rejected. */
/** Wall-clock budget for model work in one run; the worker is stopped at 150s. */
const RUN_TIME_BUDGET_MS = 105_000;
/** Temperature for a draft retry after a rejection, so the rewrite actually differs. */
const RETRY_TEMPERATURE = 0.7;
const MAX_PATH_REFILLS = 1;
/** Pillar proposals tried per refill (each costs up to 2 model calls). */
const MAX_REFILL_PATH_ATTEMPTS = 4;

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

type CopyPrior = {
  id: string;
  post_date: string;
  service_id: string;
  title: string;
  pillar_name: string;
  author_name: string;
  hook: string;
  opening: string;
  lines: string[];
  headlines?: string[];
};

function copyPriorFromBrief(row: Record<string, unknown>, pillarName: string): CopyPrior {
  const slides = carouselSlidesFromBrief(typeof row.brief === "string" ? row.brief : "");
  const lines = slides.map((slide) => slide.copy).filter((line) => line.trim());
  return {
    id: String(row.id ?? ""),
    post_date: String(row.post_date ?? ""),
    service_id: String(row.service_id ?? ""),
    title: String(row.title ?? "").replace(/\s+/g, " ").trim(),
    pillar_name: pillarName,
    author_name: String(row.author_name ?? ""),
    hook: hookFromElement(slides[0]?.elements ?? ""),
    opening: lines[0] ?? "",
    lines,
    headlines: slides.map((slide) => headlineFromElement(slide.elements)).filter(Boolean),
  };
}

function rememberCopy(memory: CopyPrior[], plan: { title?: string; slides?: unknown }, day: string, serviceId: string, pillarName: string) {
  const fingerprint = copyFingerprint(plan);
  memory.unshift({
    id: "",
    post_date: day,
    service_id: serviceId,
    title: fingerprint.title,
    pillar_name: pillarName,
    author_name: "",
    hook: fingerprint.hook,
    opening: fingerprint.lines[0] ?? "",
    lines: fingerprint.lines,
    headlines: (Array.isArray(plan.slides) ? plan.slides : [])
      .map((slide) => headlineFromElement((slide as { element?: unknown })?.element))
      .filter(Boolean),
  });
}

function checkRewriteNote(checkId: string, reasons: string[] = []): string {
  const why = reasons.length > 0 ? ` Alasan pemeriksa: ${reasons.join(" | ")}.` : "";
  return baseRewriteNote(checkId) + why;
}

function baseRewriteNote(checkId: string): string {
  if (checkId === "hookHolds") {
    return "Pemeriksaan hookHolds gagal. Tulis ulang Hook headline slide 1: paling banyak 8 kata, bahasa santai, langsung menyentuh ide (misalnya pertanyaan atau pernyataan yang bikin penasaran), jangan hanya nama menu. Slide lain tetap.";
  }
  if (checkId === "checks_incomplete") {
    return "Pemeriksaan belum lengkap. Pastikan slide 1 punya Hook headline dan Visual hook, setiap slide punya vo santai, dan isi mengikuti Development pilar.";
  }
  if (checkId === "pillarFits") {
    return "Pemeriksaan pillarFits gagal. Bentuk slide harus mengikuti Development pilar, bukan iklan produk yang sama.";
  }
  if (checkId === "messageStays") {
    return "Pemeriksaan messageStays gagal. Ganti headline dan kalimat slide 1.";
  }
  if (checkId === "usesSlang") {
    return "Pemeriksaan usesSlang gagal. Tulis ulang setiap vo dan Hook headline dengan bahasa lisan sehari-hari ke teman dekat: kamu, nggak, aja, banget, sih, deh, kok, dong bila pas. Hapus kata formal seperti Anda, tidak, sangat, namun, merupakan, dan oleh karena itu. Isi dan urutan slide tetap.";
  }
  if (checkId === "soundsSpoken") {
    return "Pemeriksaan soundsSpoken gagal. Tulis ulang vo supaya terdengar seperti diucapkan, kalimat pendek dan wajar, bukan teks brosur. Isi dan urutan slide tetap.";
  }
  return `Pemeriksaan ${checkId} gagal. Perbaiki draf tanpa menyalin rencana terakhir.`;
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
  if (body.manual != null && typeof body.manual !== "boolean") return json({ error: "invalid_input" }, 400);
  const dryRun = body.dry_run === true;
  const manual = body.manual === true;
  if (manual && mode !== "sop1") return json({ error: "invalid_input" }, 400);

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
  // Supabase stops the worker at 150s wall clock; stop starting model calls well before that.
  const runStartedAt = Date.now();
  let timeBudgetHit = false;
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

    if (manual) {
      if (caller.mode !== "user" || !userId) return json({ error: "forbidden" }, 403);
      const begun = await rpc("ai_employee_sop1_manual_begin", {
        p_user_id: userId,
        p_employee_id: employeeId,
      });
      const begunMessage = begun.body && typeof begun.body === "object"
        ? String((begun.body as { message?: unknown }).message ?? "")
        : "";
      if (begun.status < 200 || begun.status >= 300 || typeof begun.body !== "string" || !isUuid(begun.body)) {
        if (begunMessage.includes("too_soon")) return json({ ok: false, error: "too_soon" }, 409);
        if (begunMessage.includes("forbidden") || begunMessage.includes("profile_inactive")) {
          return json({ ok: false, error: "forbidden" }, 403);
        }
        if (begunMessage.includes("not_found")) return json({ ok: false, error: "not_found" }, 404);
        return json({ ok: false, error: "run_start_failed" }, 500);
      }
      runId = begun.body;
    } else {
      const started = await rpc("ai_employee_run_start", {
        p_employee_id: employeeId,
        p_sop_code: sop1 ? "SOP1" : chat ? "CHAT" : (sop3 || jobSource === "revision") ? "SOP3" : "SOP2",
      });
      runId = typeof started.body === "string" && isUuid(started.body) ? started.body : null;
      if (!runId) {
        if (jobTaken) await closeJob("failed", "run_start_failed").catch(() => undefined);
        return json({ error: "run_start_failed" }, started.status === 401 ? 500 : 502);
      }
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
      const modelScript = async (prompt: string, temperature = 0): Promise<ModelResult> => {
        if (Date.now() - runStartedAt > RUN_TIME_BUDGET_MS) {
          timeBudgetHit = true;
          return { kind: "quota" };
        }
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
          temperature,
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
        .select("id, cadence, plan_count, start_times")
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
      let preparedCarouselPath = false;
      const closeSop1 = async (status: "succeeded" | "failed" | "deferred" | "late", label: string, openCount: number) => {
        if (label === "quota" && timeBudgetHit) label = "time_budget";
        const note = `sop1 ${label} steps=${steps.length} open=${openCount} plans=${planIds.length} calls=${modelCalls}${preparedCarouselPath ? " path=1" : ""}${lastReject ? ` reject=${lastReject}` : ""}`;
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
      // Menus (sub categories) of the brief's catalog that have a real library photo.
      // The draft may pick up to 3; canva-carousel-run then places only those photos.
      const menus: { id: string; name: string }[] = [];
      {
        const catalogIds = (Array.isArray(brief?.service_ids) ? brief.service_ids : [])
          .map((id: unknown) => String(id))
          .filter((id: string) => isUuid(id));
        if (catalogIds.length > 0) {
          // The brief scope already carries the chosen sub categories; the table itself is
          // closed to the server role.
          const allowedSubs = (Array.isArray(brief?.sub_service_ids) ? brief.sub_service_ids : [])
            .map((id: unknown) => String(id))
            .filter((id: string) => isUuid(id));
          let subQuery = admin
            .from("sub_services")
            .select("id, name")
            .eq("organization_id", employee.organization_id)
            .in("service_id", catalogIds)
            .or("is_active.is.null,is_active.eq.true");
          if (allowedSubs.length > 0) subQuery = subQuery.in("id", allowedSubs);
          const subs = await subQuery.order("name").limit(60);
          const subRows = (subs.data ?? []) as Array<{ id: string; name: string | null }>;
          if (!subs.error && subRows.length > 0) {
            const photos = await admin.rpc("sub_service_library_photos", {
              p_organization_id: employee.organization_id,
              p_ids: subRows.map((row) => row.id),
            });
            const withPhoto = new Set(
              ((photos.data ?? []) as Array<{ sub_service_id?: string }>).map((row) => String(row.sub_service_id ?? "")),
            );
            for (const row of subRows) {
              const name = String(row.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
              if (name && withPhoto.has(String(row.id))) menus.push({ id: String(row.id), name });
            }
          }
        }
      }
      const menuIds = new Set(menus.map((row) => row.id));
      const chosenCatalog = catalogChoice(brief);
      if (chosenCatalog.status === "missing") {
        await closeSop1("failed", "brief_missing", 0);
        return json({ ok: false, error: "brief_missing", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }
      if (chosenCatalog.status === "many") {
        await closeSop1("failed", "catalog_limit", 0);
        return json({ ok: false, error: "catalog_limit", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }
      const preferredPillars = new Set(Array.isArray(brief?.pillar_ids) ? brief.pillar_ids.filter((id: unknown) => typeof id === "string") : []);
      const pillars = preferredPillars.size > 0
        ? pillarRows.filter((row) => preferredPillars.has(String(row.id ?? "")))
        : pillarRows;
      if (!manual && String(scheduleResult.data?.cadence ?? "") !== "days") {
        await closeSop1("failed", "schedule_missing", 0);
        return json({ ok: false, error: "schedule_missing", mode: "sop1", run_id: runId, model_calls: 0 }, 422);
      }
      const open = [sopToday];
      const catalogIndex = manual
        ? manualCatalogIndex(nayaPlans, sopToday)
        : dailySlotIndex(scheduleResult.data?.start_times, sopClock.time);
      const angleIds = Array.isArray(brief?.angle_ids)
        ? brief.angle_ids.filter((id: unknown): id is string => typeof id === "string" && isUuid(id))
        : [];
      const focused = angleIds.length > 0;
      let carouselPaths = focused ? await loadScope("carousel_paths", {}) : [];
      const adoptPathPillars = (rows: Record<string, unknown>[]) => {
        for (const path of rows) {
          const id = String(path.content_pillar_id ?? "");
          if (id && !pillars.some((row) => String(row.id ?? "") === id)) {
            pillars.push({ id, name: String(path.pillar_name ?? "") });
          }
        }
      };
      adoptPathPillars(carouselPaths);
      if (open.length === 0) {
        await closeSop1("succeeded", "target_met", 0);
        return json({ ok: true, mode: "sop1", status: "succeeded", run_id: runId, model_calls: 0, plan_count: 0, plan_ids: [] });
      }
      let openTurn: Record<string, unknown> | null = null;
      let openPillar: { id: string; name: string } | null = null;
      // Set inside the block below: builds a new carousel path when every queued path was rejected.
      let refillCarouselPath:
        | ((blocked: Set<string>) => Promise<{ kind: string; ideaId?: string; pillarId?: string }>)
        | null = null;
      {
        const textOf = (value: unknown) => (typeof value === "string" ? value.trim() : "");
        const prepareCarouselPath = async (
          mode: "path" | "open",
          extraBlocked: Set<string> = new Set(),
          maxAttempts = 6,
        ): Promise<
          | { kind: "ready"; ideaId: string; pillarId: string; openIdea?: Record<string, unknown>; openPillar?: { id: string; name: string } }
          | { kind: "blocked" }
          | { kind: "unconfirmed" }
          | { kind: "quota" }
          | { kind: "failed"; detail: { status: number; message: string } }
        > => {
          let ideaRequest = admin
            .from("thinking_lab_ideas")
            .select("id, statement, sort_order, created_at, angle_id, development_paths, validation")
            .eq("organization_id", employee.organization_id)
            .eq("status", "locked");
          if (mode === "path") ideaRequest = ideaRequest.in("angle_id", angleIds);
          const ideaQuery = await ideaRequest
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
            .limit(200);
          if (ideaQuery.error) throw new Error("context_failed");
          const ideaRows = ((ideaQuery.data ?? []) as Array<Record<string, unknown>>).filter((row) => {
            const validation = row.validation;
            const decision = validation && typeof validation === "object" ? String((validation as { decision?: unknown }).decision ?? "") : "";
            return decision === "LOLOS";
          });
          const ideaIds = ideaRows.map((row) => String(row.id ?? "")).filter((id) => isUuid(id));
          if (ideaIds.length === 0) return { kind: "blocked" };
          const planQuery = await admin
            .from("social_media_plans")
            .select("thinking_idea_id, content_pillar_id, post_date")
            .eq("organization_id", employee.organization_id)
            .in("thinking_idea_id", ideaIds);
          if (planQuery.error) throw new Error("context_failed");
          const takenPairs = new Set<string>();
          const ideaPlanCount = new Map<string, number>();
          const ideaLastUsed = new Map<string, string>();
          for (const row of planQuery.data ?? []) {
            const ideaId = String((row as { thinking_idea_id?: string }).thinking_idea_id ?? "");
            const pillarId = String((row as { content_pillar_id?: string }).content_pillar_id ?? "");
            if (!ideaId) continue;
            ideaPlanCount.set(ideaId, (ideaPlanCount.get(ideaId) ?? 0) + 1);
            if (pillarId) takenPairs.add(`${ideaId}:${pillarId}`);
            const stamp = String((row as { post_date?: string }).post_date ?? "");
            if (stamp > (ideaLastUsed.get(ideaId) ?? "")) ideaLastUsed.set(ideaId, stamp);
          }
          const openIdeas = ideaRows;
          const angleFilter = mode === "path"
            ? angleIds
            : [...new Set(ideaRows.map((row) => String(row.angle_id ?? "")).filter((id) => isUuid(id)))];
          const angleQuery = angleFilter.length === 0
            ? { data: [], error: null }
            : await admin
              .from("thinking_lab_angles")
              .select("id, statement, admission, territory_id")
              .eq("organization_id", employee.organization_id)
              .in("id", angleFilter);
          if (angleQuery.error) throw new Error("context_failed");
          const angles = new Map(
            (angleQuery.data ?? [])
              .filter((row) => String((row as { admission?: string }).admission ?? "") === "GENERATE_VALID")
              .map((row) => [String((row as { id: string }).id), row as Record<string, unknown>]),
          );
          const territoryIds = [...new Set([...angles.values()].map((row) => String(row.territory_id ?? "")).filter((id) => isUuid(id)))];
          const territoryQuery = territoryIds.length === 0
            ? { data: [], error: null }
            : await admin.from("thinking_lab_territories").select("id, statement, big_thought_id").eq("organization_id", employee.organization_id).in("id", territoryIds);
          if (territoryQuery.error) throw new Error("context_failed");
          const territories = new Map((territoryQuery.data ?? []).map((row) => [String((row as { id: string }).id), row as Record<string, unknown>]));
          const thoughtIds = [...new Set([...territories.values()].map((row) => String(row.big_thought_id ?? "")).filter((id) => isUuid(id)))];
          const thoughtQuery = thoughtIds.length === 0
            ? { data: [], error: null }
            : await admin.from("thinking_big_thoughts").select("id, statement, master_thought_id").eq("organization_id", employee.organization_id).in("id", thoughtIds);
          if (thoughtQuery.error) throw new Error("context_failed");
          const thoughts = new Map((thoughtQuery.data ?? []).map((row) => [String((row as { id: string }).id), row as Record<string, unknown>]));
          const masterIds = [...new Set([...thoughts.values()].map((row) => String(row.master_thought_id ?? "")).filter((id) => isUuid(id)))];
          const masterQuery = masterIds.length === 0
            ? { data: [], error: null }
            : await admin.from("thinking_master_thoughts").select("id, statement, workspace").eq("organization_id", employee.organization_id).in("id", masterIds);
          if (masterQuery.error) throw new Error("context_failed");
          const masters = new Map(
            (masterQuery.data ?? [])
              .filter((row) => String((row as { workspace?: string }).workspace ?? "") === "thinking_lab")
              .map((row) => [String((row as { id: string }).id), row as Record<string, unknown>]),
          );
          const candidates = openIdeas.flatMap((idea) => {
            const angle = angles.get(String(idea.angle_id ?? ""));
            const territory = angle ? territories.get(String(angle.territory_id ?? "")) : undefined;
            const thought = territory ? thoughts.get(String(territory.big_thought_id ?? "")) : undefined;
            const master = thought ? masters.get(String(thought.master_thought_id ?? "")) : undefined;
            const statement = textOf(idea.statement);
            if (!angle || !territory || !thought || !master || !statement) return [];
            return [{
              id: String(idea.id),
              angleId: String(idea.angle_id ?? ""),
              statement,
              sortOrder: Number(idea.sort_order) || 0,
              createdAt: textOf(idea.created_at),
              developmentPaths: idea.development_paths,
              angleStatement: textOf(angle.statement),
              territoryStatement: textOf(territory.statement),
              bigThoughtStatement: textOf(thought.statement),
              masterStatement: textOf(master.statement),
            }];
          }).sort((left, right) => {
            const countDiff = (ideaPlanCount.get(left.id) ?? 0) - (ideaPlanCount.get(right.id) ?? 0);
            if (countDiff !== 0) return countDiff;
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
            return left.createdAt.localeCompare(right.createdAt);
          });
          // A refill skips every idea whose path was rejected, not only that idea/pillar pair:
          // another pillar on the same idea gives the same copy and is rejected again.
          const rejectedIdeaIds = new Set([...extraBlocked].map((pair) => pair.split(":")[0]).filter(Boolean));
          if (rejectedIdeaIds.size > 0) {
            for (let index = candidates.length - 1; index >= 0; index -= 1) {
              if (rejectedIdeaIds.has(candidates[index].id)) candidates.splice(index, 1);
            }
          }
          if (candidates.length === 0) return { kind: "blocked" };
          const pillarQuery = await admin
            .from("content_pillars")
            .select("id, name, funnel_stage, category, description, organization_id, is_default")
            .eq("is_active", true)
            .or(`is_default.eq.true,organization_id.eq.${employee.organization_id}`);
          if (pillarQuery.error) throw new Error("context_failed");
          const reviewPillars = ((pillarQuery.data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
            const id = String(row.id ?? "");
            const name = textOf(row.name);
            const own = row.is_default === true || String(row.organization_id ?? "") === employee.organization_id;
            if (!own || !isUuid(id) || !name) return [];
            if (preferredPillars.size > 0 && !preferredPillars.has(id)) return [];
            return [{
              id,
              name,
              funnel: textOf(row.funnel_stage),
              category: textOf(row.category),
              description: textOf(row.description),
            }];
          });
          if (reviewPillars.length === 0) return { kind: "failed", detail: { status: 0, message: "no_pillars" } };
          const monthKey = sopToday.slice(0, 7);
          const since = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
          const usageQuery = await admin
            .from("social_media_plans")
            .select("content_pillar_id, post_date")
            .eq("organization_id", employee.organization_id)
            .gte("post_date", since);
          if (usageQuery.error) throw new Error("context_failed");
          const jakartaMonth = (value: unknown) => {
            const time = new Date(String(value ?? ""));
            if (Number.isNaN(time.getTime())) return "";
            return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit" }).format(time).slice(0, 7);
          };
          const usage = new Map<string, { id: string; count: number; lastUsed: string }>();
          for (const row of usageQuery.data ?? []) {
            if (jakartaMonth((row as { post_date?: string }).post_date) !== monthKey) continue;
            const id = String((row as { content_pillar_id?: string }).content_pillar_id ?? "");
            if (!isUuid(id)) continue;
            const current = usage.get(id) ?? { id, count: 0, lastUsed: "" };
            current.count += 1;
            const stamp = String((row as { post_date?: string }).post_date ?? "");
            if (stamp > current.lastUsed) current.lastUsed = stamp;
            usage.set(id, current);
          }
          const rotated = rankPillarsForRotation(reviewPillars, [...usage.values()]);
          const latestQuery = await admin
            .from("social_media_plans")
            .select("thinking_idea_id, content_pillar_id")
            .eq("organization_id", employee.organization_id)
            .order("post_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);
          if (latestQuery.error) throw new Error("context_failed");
          const latest = (latestQuery.data ?? [])[0] as { thinking_idea_id?: string; content_pillar_id?: string } | undefined;
          const previousIdeaId = String(latest?.thinking_idea_id ?? "");
          const previousPillarId = String(latest?.content_pillar_id ?? "");
          const previousAngleId = String(candidates.find((row) => row.id === previousIdeaId)?.angleId ?? "");
          const turnIdeas = candidates.map((row) => ({
            id: row.id,
            angleId: row.angleId,
            planCount: ideaPlanCount.get(row.id) ?? 0,
            lastUsed: ideaLastUsed.get(row.id) ?? "",
          }));
          const turnPillars = rotated.map((pillar) => ({
            id: pillar.id,
            name: pillar.name,
            count: usage.get(pillar.id)?.count ?? 0,
            lastUsed: usage.get(pillar.id)?.lastUsed ?? "",
          }));
          const turnAngles = mode === "path"
            ? [...angles.keys()].map((id) => ({
              id,
              lastUsed: turnIdeas
                .filter((idea) => idea.angleId === id)
                .reduce((latestStamp, idea) => (idea.lastUsed > latestStamp ? idea.lastUsed : latestStamp), ""),
            }))
            : [];
          const blockedPairs = new Set([...takenPairs, ...extraBlocked]);
          const ask = (prompt: string) => withRetry(() => modelScript(prompt));
          let attempts = 0;
          while (attempts < maxAttempts) {
            const turn = chooseContentTurn({
              angles: turnAngles,
              ideas: turnIdeas,
              pillars: turnPillars,
              takenPairs: [...blockedPairs],
              previous: { angleId: previousAngleId, ideaId: previousIdeaId, pillarId: previousPillarId },
            });
            if (!turn) return { kind: "blocked" };
            const candidate = candidates.find((row) => row.id === turn.ideaId);
            const pillar = rotated.find((row) => row.id === turn.pillarId);
            if (!candidate || !pillar) return { kind: "blocked" };
            if (mode === "open") {
              return {
                kind: "ready",
                ideaId: candidate.id,
                pillarId: pillar.id,
                openIdea: {
                  id: candidate.id,
                  idea_id: candidate.id,
                  idea_statement: candidate.statement,
                  statement: candidate.statement,
                  angle_statement: candidate.angleStatement,
                  territory_statement: candidate.territoryStatement,
                  big_thought_statement: candidate.bigThoughtStatement,
                  master_statement: candidate.masterStatement,
                  used: false,
                  skip: false,
                },
                openPillar: { id: pillar.id, name: pillar.name },
              };
            }
            const queued = carouselPaths.find((row) => String(row.idea_id ?? "") === candidate.id && String(row.content_pillar_id ?? "") === pillar.id && row.used !== true && row.skip !== true);
            if (queued) {
              carouselPaths = [queued];
              return { kind: "ready", ideaId: candidate.id, pillarId: pillar.id };
            }
            attempts += 1;
            const context = [candidate.masterStatement, candidate.bigThoughtStatement, candidate.territoryStatement, candidate.angleStatement, candidate.statement].filter(Boolean).join("\n");
            const proposed = await ask(buildCarouselPathPrompt({ context, pillars: [pillar] }));
            if (proposed.kind === "quota") return { kind: "quota" };
            if (proposed.kind === "failed") return { kind: "failed", detail: proposed.detail };
            const review = parseCarouselPathReviews(proposed.script, [pillar])[0];
            const checked = review && review.contentPillarId === pillar.id
              ? await ask(buildCarouselPathCheckPrompt({
                context,
                pillar,
                development: review.development,
                claim: review.reason,
              }))
              : null;
            if (checked && checked.kind === "quota") return { kind: "quota" };
            if (checked && checked.kind === "failed") return { kind: "failed", detail: checked.detail };
            const verdict = checked && checked.kind === "ok" ? parseCarouselPathCheck(checked.script) : null;
            const record = verdict?.pass
              ? carouselDevelopmentPath({
                id: pillar.id,
                name: pillar.name,
                development: review?.development ?? "",
                reason: verdict.reason,
                savedAt: new Date().toISOString(),
              })
              : null;
            if (!record) {
              blockedPairs.add(`${candidate.id}:${pillar.id}`);
              continue;
            }
            if (!dryRun) {
              const saved = await admin
                .from("thinking_lab_ideas")
                .update({ development_paths: appendCarouselDevelopmentPath(candidate.developmentPaths, record) })
                .eq("id", candidate.id)
                .eq("organization_id", employee.organization_id)
                .eq("status", "locked");
              if (saved.error) throw new Error("context_failed");
            } else {
              carouselPaths = [{
                idea_id: candidate.id,
                content_pillar_id: record.contentPillarId,
                pillar_name: record.pillarName,
                development: record.reviews[0]?.development ?? "",
                prompt_voice: textOf(brief?.voice),
                delivery_voice: "",
                is_repeat: false,
                idea_statement: candidate.statement,
                angle_statement: candidate.angleStatement,
                territory_statement: candidate.territoryStatement,
                big_thought_statement: candidate.bigThoughtStatement,
                master_statement: candidate.masterStatement,
              }];
            }
            preparedCarouselPath = true;
            return { kind: "ready", ideaId: candidate.id, pillarId: pillar.id };
          }
          return { kind: "unconfirmed" };
        };
        if (focused) {
          refillCarouselPath = (blocked) => prepareCarouselPath("path", blocked, MAX_REFILL_PATH_ATTEMPTS);
        }
        const prepared = await prepareCarouselPath(focused ? "path" : "open");
        if (prepared.kind === "quota") {
          await closeSop1("deferred", "quota", open.length);
          return json({ ok: false, status: "deferred", error: "quota_exceeded", mode: "sop1", run_id: runId, model_calls: modelCalls, plan_count: 0, plan_ids: [] });
        }
        if (prepared.kind === "failed") {
          const label = prepared.detail.message === "no_pillars" ? "no_pillars" : "model_failed";
          await closeSop1("failed", label, open.length);
          return json({
            ok: false,
            error: label,
            mode: "sop1",
            model_status: prepared.detail.status,
            model_error: prepared.detail.message,
            run_id: runId,
            model_calls: modelCalls,
            plan_count: 0,
            plan_ids: [],
          }, label === "no_pillars" ? 422 : 500);
        }
        if (prepared.kind !== "ready") {
          const label = prepared.kind === "blocked" ? "ideas_blocked" : "path_unconfirmed";
          await closeSop1("failed", label, open.length);
          return json({ ok: false, error: label, mode: "sop1", status: "failed", run_id: runId, model_calls: modelCalls, plan_count: 0, plan_ids: [] }, 422);
        }
        if (!focused) {
          openTurn = prepared.openIdea ?? null;
          openPillar = prepared.openPillar ?? null;
          if (!openTurn || !openPillar?.id) {
            await closeSop1("failed", "ideas_blocked", open.length);
            return json({ ok: false, error: "ideas_blocked", mode: "sop1", status: "failed", run_id: runId, model_calls: modelCalls, plan_count: 0, plan_ids: [] }, 422);
          }
          if (!pillars.some((row) => String(row.id ?? "") === openPillar?.id)) {
            pillars.push({ id: openPillar.id, name: openPillar.name });
          }
        } else if (!dryRun) {
          const loaded = await loadScope("carousel_paths", {});
          carouselPaths = orderCopyFallbackPaths(loaded, prepared.ideaId, prepared.pillarId);
          adoptPathPillars(carouselPaths);
        } else {
          adoptPathPillars(carouselPaths);
        }
        if (focused && !carouselPaths.some((row) => String(row.idea_id ?? "") === prepared.ideaId && String(row.content_pillar_id ?? "") === prepared.pillarId)) {
          await closeSop1("failed", "path_unconfirmed", open.length);
          return json({ ok: false, error: "path_unconfirmed", mode: "sop1", status: "failed", run_id: runId, model_calls: modelCalls, plan_count: 0, plan_ids: [] }, 422);
        }
      }

      const draftNotes = {
        required: typeof brief?.required_notes === "string" ? brief.required_notes : "",
        forbidden: typeof brief?.forbidden_notes === "string" ? brief.forbidden_notes : "",
      };
      const drafts: { title: string; post_date: string; brief: string; caption: string; content_pillar_id: string }[] = [];
      let stop: "done" | "quota" | "pillar_cap" | "failed" | "ideas_exhausted" = "done";
      let failure = { status: 0, message: "model_failed" };
      const seenPriorIds = new Set<string>();
      const copyMemory: CopyPrior[] = [];
      // Product Knowledge picked in the brief: its claims may repeat across plans.
      const claimTokens = copyClaimTokens(product.filter((row) => row.selected === true));
      const pillarNameOf = (id: string) => {
        const known = pillars.find((row) => String(row.id ?? "") === id);
        if (known?.name) return String(known.name);
        const listed = calendar.find((row) => String(row.content_pillar_id ?? "") === id);
        return String(listed?.pillar_name ?? "");
      };
      for (const row of nayaPlans) {
        const id = String(row.id ?? "");
        if (id && seenPriorIds.has(id)) continue;
        if (id) seenPriorIds.add(id);
        copyMemory.push(copyPriorFromBrief(row, pillarNameOf(String(row.content_pillar_id ?? ""))));
      }
      for (const row of calendar) {
        const id = String(row.id ?? "");
        if (id && seenPriorIds.has(id)) continue;
        const title = String(row.title ?? "").replace(/\s+/g, " ").trim();
        if (!title) continue;
        if (id) seenPriorIds.add(id);
        copyMemory.push({
          id,
          post_date: String(row.post_date ?? ""),
          service_id: String(row.service_id ?? ""),
          title,
          pillar_name: String(row.pillar_name ?? ""),
          author_name: String(row.author_name ?? ""),
          hook: "",
          opening: "",
          lines: [],
        });
      }
      // Storyboards of this employee's latest plans, newest first, for reference rotation.
      const recentReferenceBriefs: string[] = [];
      {
        const recent = await admin
          .from("social_media_plans")
          .select("brief")
          .eq("organization_id", employee.organization_id)
          .eq("pic_id", employeeId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (!recent.error) {
          for (const row of recent.data ?? []) recentReferenceBriefs.push(String((row as { brief?: unknown }).brief ?? ""));
        }
      }
      // Plans this employee already has: the opening style rotates from here.
      const planCountResult = await admin
        .from("social_media_plans")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", employee.organization_id)
        .eq("pic_id", employeeId);
      const openingSeed = planCountResult.count ?? 0;
      let dayIndex = 0;
      let ideaTries = 0;
      let ideaCap = focused ? Math.max(carouselPaths.length, 1) : 1;
      let pathRefills = 0;
      const rejectedPairs = new Set<string>();
      const pathPair = (row: Record<string, unknown>) => `${String(row.idea_id ?? "")}:${String(row.content_pillar_id ?? "")}`;
      const nextPath = () => carouselPaths.find((row) => row.used !== true && row.skip !== true) ?? null;
      while (dayIndex < open.length && stop === "done") {
        // Every queued path was rejected (e.g. copy too close to earlier plans):
        // build a path for another locked idea before giving up on this run.
        if (
          focused &&
          refillCarouselPath &&
          pathRefills < MAX_PATH_REFILLS &&
          (!nextPath() || ideaTries >= ideaCap)
        ) {
          pathRefills += 1;
          for (const row of carouselPaths) {
            if (row.skip === true || row.used === true) rejectedPairs.add(pathPair(row));
          }
          const refilled = await refillCarouselPath(rejectedPairs);
          if (refilled.kind === "quota") {
            stop = "quota";
            break;
          }
          if (refilled.kind === "ready") {
            if (!dryRun) {
              const loaded = await loadScope("carousel_paths", {});
              carouselPaths = orderCopyFallbackPaths(
                loaded.filter((row: Record<string, unknown>) => !rejectedPairs.has(pathPair(row))),
                refilled.ideaId,
                refilled.pillarId,
              );
            }
            adoptPathPillars(carouselPaths);
            ideaCap = ideaTries + Math.max(carouselPaths.filter((row) => row.used !== true && row.skip !== true).length, 1);
          }
        }
        ideaTries += 1;
        if (ideaTries > ideaCap) {
          stop = "ideas_exhausted";
          break;
        }
        const day = open[dayIndex];
        const path = focused ? nextPath() : null;
        const idea = focused ? path : (openTurn && openTurn.skip !== true ? openTurn : null);
        if (!idea) {
          stop = "ideas_exhausted";
          break;
        }
        const choice = focused
          ? { id: String(path?.content_pillar_id ?? ""), name: String(path?.pillar_name ?? ""), capped: false }
          : openPillar
            ? { id: openPillar.id, name: openPillar.name, capped: false }
            : null;
        if (!choice?.id) {
          stop = "pillar_cap";
          break;
        }
        const voicedBrief = focused
          ? { ...brief, voice: String(path?.prompt_voice ?? brief?.voice ?? "") }
          : brief;
        // One layout reference per carousel, rotated so every slot gets used.
        const referenceSlot = rotateReference(referencePositions(brief), recentReferenceBriefs);
        const promptBrief = briefWithReference(voicedBrief, referenceSlot);
        const promptPath = focused ? path : null;
        const service = chooseBrandFocus({ brief, catalog, dayIndex: catalogIndex, allowOverride: false });
        if (!service) {
          stop = "failed";
          failure = { status: 0, message: "brief_missing" };
          break;
        }
        const compared = selectCopyPriors(copyMemory, service.id, 8);
        const promptPlans = compared.slice(0, 6);
        let avoid = "";
        let plan: ReturnType<typeof parseCarouselDraft> & { service_id: string } | null = null;
        let verdict: ReturnType<typeof parseExecutionVerdict> = null;
        let executionId: string | null = null;
        for (let attempt = 1; attempt <= 3 && stop === "done"; attempt += 1) {
          const drafted = await withRetry(async () => {
            // A retry after a rejected draft needs a different answer; at temperature 0 the
            // model wrote the same title three times in a row.
            const result = await modelScript(buildSop1Prompt({
              day,
              pillar: choice,
              steps,
              catalog,
              thinking,
              feedback,
              plans: promptPlans,
              brief: promptBrief,
              performance,
              service,
              idea,
              product,
              path: promptPath,
              avoid,
              menus,
              // A rejected draft also moves to the next opening style.
              openingStyle: openingStyleFor(openingSeed + dayIndex + attempt - 1),
            }), avoid ? RETRY_TEMPERATURE : 0);
            if (result.kind !== "ok") return result;
            const parsed = parseCarouselDraft(result.script, draftNotes);
            if (parsed) parsed.slides = normalizeCarouselReference(parsed.slides, referencePositions(promptBrief));
            if (!parsed || !pillars.some((row) => String(row.id ?? "") === choice.id) || !carouselReferenceOk(parsed.slides, referencePositions(promptBrief))) {
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
            break;
          }
          const parsed = parseCarouselDraft(drafted.script, draftNotes);
          if (!parsed) { idea.skip = true; break; }
          const candidate = { ...parsed, post_date: day, content_pillar_id: choice.id, service_id: service.id };
          const collision = copyCollides(candidate, compared, { claimTokens });
          if (collision) {
            lastReject = `copy:${collision.field}@${String(collision.title ?? "").replace(/[^\p{L}\p{N} ]+/gu, "").slice(0, 30)}`;
            console.log(JSON.stringify({
              event: "sop1_copy_reject",
              run_id: runId,
              attempt,
              field: collision.field,
              prior_title: collision.title,
              prior_used: "used" in collision ? collision.used : undefined,
              draft_title: candidate.title,
              draft_opening: copyFingerprint(candidate).lines[0] ?? "",
            }));
            if (attempt >= 3) { idea.skip = true; break; }
            avoid = collision.reason;
            continue;
          }
          // Slide titles are what Canva shows biggest; repeats are only logged for now.
          const repeated = headlineRepeats(candidate.slides.map((slide) => headlineFromElement(slide.element)), compared);
          if (repeated.length > 0) {
            console.log(JSON.stringify({ event: "sop1_headline_repeat", run_id: runId, attempt, draft_title: candidate.title, repeats: repeated.slice(0, 5) }));
          }
          const judge = async (draft: typeof candidate) => withRetry(async () => {
            const result = await modelScript(buildExecutionCheckPrompt({
              day,
              pillar: choice,
              idea,
              draft,
              path: promptPath,
              priors: promptPlans,
            }));
            if (result.kind !== "ok") return result;
            return parseExecutionVerdict(result.script)
              ? { kind: "ok" as const, script: result.script }
              : { kind: "failed" as const, detail: { status: 0, message: "invalid_model_output" } };
          });
          const checked = await judge(candidate);
          if (checked.kind === "quota") { stop = "quota"; break; }
          if (checked.kind === "failed") {
            if (checked.detail.message !== "invalid_model_output") {
              stop = "failed";
              failure = checked.detail;
              break;
            }
            idea.skip = true;
            break;
          }
          const nextVerdict = parseExecutionVerdict(checked.script);
          if (!nextVerdict?.ok) {
            lastReject = String(nextVerdict?.check_id ?? "unparsed").slice(0, 40);
            if (attempt >= 3) { idea.skip = true; break; }
            avoid = checkRewriteNote(lastReject, Array.isArray(nextVerdict?.reasons) ? nextVerdict.reasons : []);
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
                statement: nextVerdict.statement,
                checks: nextVerdict.checks,
                facts: nextVerdict.facts,
                script: nextVerdict.script,
              }, claimToken),
            });
            const accepted = judged.body && typeof judged.body === "object"
              ? (judged.body as { accepted?: unknown; execution_id?: unknown; check_id?: unknown })
              : null;
            if (judged.status < 200 || judged.status >= 300 || accepted?.accepted !== true || !isUuid(accepted.execution_id)) {
              const rejected = accepted && typeof accepted.check_id === "string" ? accepted.check_id : "db";
              lastReject = rejected.slice(0, 40);
              idea.skip = true;
              break;
            }
            executionId = String(accepted.execution_id);
          }
          plan = candidate;
          verdict = nextVerdict;
          lastReject = "";
          break;
        }
        if (stop !== "done") break;
        if (!plan || !verdict?.ok) continue;
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
          rememberCopy(copyMemory, plan, day, service.id, choice.name);
          calendar.push({ post_date: day, content_pillar_id: choice.id });
          nayaPlans.push({ post_date: day, content_pillar_id: choice.id, author_employee_id: employeeId });
          dayIndex += 1;
          continue;
        }
        const palette = catalogPalette(brief);
        const { sub_service_ids: draftMenus, ...planPayload } = plan as typeof plan & { sub_service_ids?: unknown };
        const pickedMenus = pickMenuIds(draftMenus, menuIds);
        const performed = await rpc("ai_employee_perform", {
          p_employee_id: employeeId,
          p_run_id: runId,
          p_action: "thinking.plan.save",
          p_payload: withJobClaim({
            ...planPayload,
            ...(palette ? { palette } : {}),
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
        if (pickedMenus.length > 0) {
          const tagged = await admin
            .from("social_media_plans")
            .update({ sub_service_id: pickedMenus[0], sub_service_ids: pickedMenus })
            .eq("id", String(createdId))
            .eq("organization_id", employee.organization_id);
          console.log(JSON.stringify({
            event: tagged.error ? "sop1_menu_tag_failed" : "sop1_menu_tagged",
            run_id: runId,
            plan_id: String(createdId),
            menus: pickedMenus.map((id) => menus.find((row) => row.id === id)?.name ?? id),
          }));
        }
        takeProduct();
        idea.used = true;
        planIds.push(String(createdId));
        if (referenceSlot) recentReferenceBriefs.unshift(`Referensi ${referenceSlot}`);
        rememberCopy(copyMemory, plan, day, service.id, choice.name);
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
      const savedCount = dryRun ? drafts.length : planIds.length;
      // Nothing saved because every draft failed the checks is a failure, not a success.
      const status = stop === "quota"
        ? "deferred"
        : stop === "ideas_exhausted" && savedCount === 0
          ? "failed"
          : "succeeded";
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
        // The page shows why no plan came: every draft failed the checks, or time/quota ran out.
        ...(status === "failed" ? { error: label } : {}),
        ...(status === "deferred" ? { error: timeBudgetHit ? "time_budget" : "quota_exceeded" } : {}),
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
