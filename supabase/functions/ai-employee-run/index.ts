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
  brandLockupFromBrief,
  diagnoseCarouselDraftDetail,
  invalidRewriteNote,
  parseCarouselDraft,
  pickMenuIds,
  pickSystemHook,
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
  usedTopicPhrases,
  orderCopyFallbackPaths,
  selectCopyPriors,
  pickUnusedIdea,
  chooseSop1Pillar,
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
import {
  buildSop4Prompt,
  buildStoryExecutionCheckPrompt,
  diagnoseStoryDraftDetail,
  readStoryDraftCandidate,
  storyPalette,
} from "../_shared/aiEmployee/storyDraft.mjs";

/** Wall-clock budget for model work in one run; the worker is stopped at 150s. */
const RUN_TIME_BUDGET_MS = 105_000;
/** Leave headroom so a draft/judge pair is not started when it cannot finish. */
const MIN_MODEL_REMAINING_MS = 35_000;
/** Temperature for a draft retry after a rejection, so the rewrite actually differs. */
const RETRY_TEMPERATURE = 0.7;
/** Draft rewrite attempts when time is still comfortable. */
const MAX_DRAFT_ATTEMPTS = 3;
/** Draft rewrite attempts after half the wall budget is gone. */
const MAX_DRAFT_ATTEMPTS_TIGHT = 2;

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
  if (checkId === "mechanismVisible") {
    return "Pemeriksaan mechanismVisible gagal. Bangun ulang title, Hook headline, dan alur slide dari Idea yang dipakai, bukan dari klaim Product Knowledge.";
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
  if (mode !== "plan" && mode !== "chat" && mode !== "sop1" && mode !== "sop3" && mode !== "sop4" && mode !== "job") {
    return json({ error: "invalid_input" }, 400);
  }
  const chat = mode === "chat";
  const sop1 = mode === "sop1";
  const sop3 = mode === "sop3";
  const sop4 = mode === "sop4";
  const jobMode = mode === "job";
  const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
  if (jobMode && (!isUuid(jobId) || body.dry_run === true)) return json({ error: "invalid_input" }, 400);
  if (!isUuid(employeeId) || instruction.length > 4000 || (!sop1 && !sop4 && !jobMode && !instruction)) {
    return json({ error: "invalid_input" }, 400);
  }
  if (requestedDate && (!isDay(requestedDate) || requestedDate < today)) return json({ error: "invalid_input" }, 400);
  if (body.dry_run != null && typeof body.dry_run !== "boolean") return json({ error: "invalid_input" }, 400);
  if (body.manual != null && typeof body.manual !== "boolean") return json({ error: "invalid_input" }, 400);
  const dryRun = body.dry_run === true;
  const manual = body.manual === true;
  if (manual && mode !== "sop1" && mode !== "sop4") return json({ error: "invalid_input" }, 400);

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
      const beginRpc = sop4 ? "ai_employee_sop4_manual_begin" : "ai_employee_sop1_manual_begin";
      const begun = await rpc(beginRpc, {
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
        p_sop_code: sop1 ? "SOP1" : sop4 ? "SOP4" : chat ? "CHAT" : (sop3 || jobSource === "revision") ? "SOP3" : "SOP2",
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
      type CaptionRejectMeta = {
        reason: string;
        caption_len: number;
        body_len: number;
        has_hash: boolean;
        raw_caption_len?: number;
      };
      type ModelResult =
        | { kind: "ok"; script: string }
        | { kind: "quota" }
        | { kind: "failed"; detail: { status: number; message: string; caption?: CaptionRejectMeta | null } };
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
      const remainingMs = () => RUN_TIME_BUDGET_MS - (Date.now() - runStartedAt);
      const modelScript = async (prompt: string, temperature = 0): Promise<ModelResult> => {
        if (remainingMs() <= 0) {
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
        // A second model call when the budget is almost gone only burns quota into time_budget.
        if (remainingMs() < MIN_MODEL_REMAINING_MS) {
          timeBudgetHit = true;
          return { kind: "quota" };
        }
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
      // The last idea and pillar this run worked on, for the run log on the employee page.
      let attemptedIdeaId = "";
      let attemptedPillarId = "";
      let writtenAttemptKey = "";
      const attempt = (ideaId: unknown, pillarId: unknown) => {
        const idea = String(ideaId ?? "");
        const pillar = String(pillarId ?? "");
        if (isUuid(idea)) attemptedIdeaId = idea;
        if (isUuid(pillar)) attemptedPillarId = pillar;
        const key = `${attemptedIdeaId}:${attemptedPillarId}`;
        if (!runId || (!attemptedIdeaId && !attemptedPillarId) || key === writtenAttemptKey) return;
        writtenAttemptKey = key;
        // Live log/map need the pair while status is still running — do not wait for closeSop1.
        void admin
          .from("ai_employee_runs")
          .update({
            attempted_idea_id: attemptedIdeaId || null,
            attempted_pillar_id: attemptedPillarId || null,
          })
          .eq("id", runId)
          .eq("employee_id", employeeId)
          .eq("status", "running")
          .then(({ error }) => {
            if (error) console.error("ai-employee-run attempt_live:", error.message.slice(0, 120));
          });
      };
      const closeSop1 = async (status: "succeeded" | "failed" | "deferred" | "late", label: string, openCount: number) => {
        if (label === "quota" && timeBudgetHit) label = "time_budget";
        if (runId && (attemptedIdeaId || attemptedPillarId)) {
          const saved = await admin
            .from("ai_employee_runs")
            .update({ attempted_idea_id: attemptedIdeaId || null, attempted_pillar_id: attemptedPillarId || null })
            .eq("id", runId)
            .eq("employee_id", employeeId);
          if (saved.error) console.error("ai-employee-run attempt:", saved.error.message.slice(0, 120));
        }
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
      const useSystemHooks = brief?.use_system_hooks !== false;
      let systemHooks: Array<{ id?: string; name?: string; description?: string; hook_content?: string }> = [];
      if (useSystemHooks) {
        const [defaultHooks, orgHooks] = await Promise.all([
          admin.from("product_knowledge_hooks").select("id, name, description, hook_content, organization_id, created_at").is("organization_id", null).not("name", "is", null),
          admin.from("product_knowledge_hooks").select("id, name, description, hook_content, organization_id, created_at").eq("organization_id", employee.organization_id).not("name", "is", null),
        ]);
        if (!defaultHooks.error && !orgHooks.error) {
          systemHooks = [...(orgHooks.data ?? []), ...(defaultHooks.data ?? [])] as typeof systemHooks;
        } else {
          console.log(JSON.stringify({ event: "sop1_hooks_load_failed", run_id: runId, default: defaultHooks.error?.message, org: orgHooks.error?.message }));
        }
      }
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
      // Funnel/category enrich CTA tone in SOP1; the pillars scope only returns id/name.
      const pillarMeta = new Map<string, { name: string; funnel: string; category: string; description: string }>();
      {
        const textOf = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
        const metaQuery = await admin
          .from("content_pillars")
          .select("id, name, funnel_stage, category, description, organization_id, is_default")
          .eq("is_active", true)
          .or(`is_default.eq.true,organization_id.eq.${employee.organization_id}`);
        if (!metaQuery.error) {
          for (const row of (metaQuery.data ?? []) as Array<Record<string, unknown>>) {
            const id = String(row.id ?? "");
            const own = row.is_default === true || String(row.organization_id ?? "") === employee.organization_id;
            if (!own || !isUuid(id)) continue;
            pillarMeta.set(id, {
              name: textOf(row.name),
              funnel: textOf(row.funnel_stage),
              category: textOf(row.category),
              description: textOf(row.description),
            });
          }
        }
      }
      const withPillarMeta = (id: string, name: string) => {
        const meta = pillarMeta.get(id);
        return {
          id,
          name: meta?.name || name,
          funnel: meta?.funnel ?? "",
          category: meta?.category ?? "",
          description: meta?.description ?? "",
          capped: false as const,
        };
      };
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
      let openPillar: { id: string; name: string; funnel: string; category: string; description: string } | null = null;
      // Idea/pillar pairs that already burned a full run today without a plan stay off the queue.
      // Hard fails also cool the whole idea: another pillar on the same idea usually reprints the same copy.
      const cooledPairs = new Set<string>();
      const cooledIdeas = new Set<string>();
      {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const recentFails = await admin
          .from("ai_employee_runs")
          .select("attempted_idea_id, attempted_pillar_id, note")
          .eq("employee_id", employeeId)
          .eq("organization_id", employee.organization_id)
          .eq("sop_code", "SOP1")
          .neq("status", "running")
          .eq("plan_count", 0)
          .neq("id", runId)
          .gte("started_at", since)
          .not("attempted_idea_id", "is", null)
          .order("started_at", { ascending: false })
          .limit(8);
        const failCount = new Map<string, number>();
        for (const row of (recentFails.data ?? []) as Array<{ attempted_idea_id?: string; attempted_pillar_id?: string; note?: string }>) {
          const ideaId = String(row.attempted_idea_id ?? "");
          const pair = `${ideaId}:${String(row.attempted_pillar_id ?? "")}`;
          const note = String(row.note ?? "");
          // time_budget / checks_failed / copy burn the idea; cool after one miss so the next
          // click does not spend another 105s hopping pillars on the same draft.
          const hard = /time_budget|checks_failed|copy:/.test(note);
          failCount.set(pair, (failCount.get(pair) ?? 0) + (hard ? 2 : 1));
          if (hard && isUuid(ideaId)) cooledIdeas.add(ideaId);
        }
        for (const [pair, count] of failCount) if (count >= 2) cooledPairs.add(pair);
        if (cooledPairs.size > 0 || cooledIdeas.size > 0) {
          console.log(JSON.stringify({
            event: "sop1_cooldown",
            run_id: runId,
            pairs: [...cooledPairs].slice(0, 5),
            ideas: [...cooledIdeas].slice(0, 5),
          }));
        }
      }
      if (focused && (cooledPairs.size > 0 || cooledIdeas.size > 0)) {
        carouselPaths = carouselPaths.filter((row) => {
          const ideaId = String(row.idea_id ?? "");
          if (cooledIdeas.has(ideaId)) return false;
          return !cooledPairs.has(`${ideaId}:${String(row.content_pillar_id ?? "")}`);
        });
      }
      {
        const textOf = (value: unknown) => (typeof value === "string" ? value.trim() : "");
        // Focused runs only consume Thinking Lab locks already in carousel_paths — never invent paths.
        const prepareCarouselPath = async (
          mode: "path" | "open",
          extraBlocked: Set<string> = new Set(),
          maxAttempts = 6,
        ): Promise<
          | { kind: "ready"; ideaId: string; pillarId: string; openIdea?: Record<string, unknown>; openPillar?: { id: string; name: string; funnel: string; category: string; description: string } }
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
          if (mode === "path") {
            // Serve only Thinking Lab locks already in the queue — never invent idea×pillar pairs.
            const usableQueued = carouselPaths.filter((row) => {
              const ideaId = String(row.idea_id ?? "");
              const pillarId = String(row.content_pillar_id ?? "");
              if (row.used === true || row.skip === true) return false;
              if (blockedPairs.has(`${ideaId}:`) || blockedPairs.has(`${ideaId}:${pillarId}`)) return false;
              return true;
            });
            if (usableQueued.length === 0) return { kind: "unconfirmed" };
            const queuedIdeaIds = new Set(usableQueued.map((row) => String(row.idea_id ?? "")).filter((id) => isUuid(id)));
            const queuedPillarIds = new Set(
              usableQueued.map((row) => String(row.content_pillar_id ?? "")).filter((id) => isUuid(id)),
            );
            const pathIdeas = turnIdeas.filter((idea) => queuedIdeaIds.has(idea.id));
            const pathPillars = turnPillars.filter((pillar) => queuedPillarIds.has(pillar.id));
            const pathAngles = turnAngles.filter((angle) => pathIdeas.some((idea) => idea.angleId === angle.id));
            const turn = chooseContentTurn({
              angles: pathAngles,
              ideas: pathIdeas,
              pillars: pathPillars,
              takenPairs: [...blockedPairs],
              previous: { angleId: previousAngleId, ideaId: previousIdeaId, pillarId: previousPillarId },
            });
            const pick = turn
              ? usableQueued.find((row) =>
                String(row.idea_id ?? "") === turn.ideaId
                && String(row.content_pillar_id ?? "") === turn.pillarId
                && !blockedPairs.has(`${turn.ideaId}:${turn.pillarId}`))
              : null;
            const queued = pick ?? usableQueued.find((row) => {
              const ideaId = String(row.idea_id ?? "");
              const pillarId = String(row.content_pillar_id ?? "");
              return !blockedPairs.has(`${ideaId}:`) && !blockedPairs.has(`${ideaId}:${pillarId}`);
            });
            if (!queued) return { kind: "unconfirmed" };
            const ideaId = String(queued.idea_id ?? "");
            const pillarId = String(queued.content_pillar_id ?? "");
            attempt(ideaId, pillarId);
            carouselPaths = [queued];
            return { kind: "ready", ideaId, pillarId };
          }
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
            attempt(candidate.id, pillar.id);
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
              openPillar: withPillarMeta(pillar.id, pillar.name),
            };
          }
          return { kind: "blocked" };
        };
        const blockedFromCooldown = () => new Set<string>([
          ...cooledPairs,
          ...[...cooledIdeas].map((id) => `${id}:`),
        ]);
        // An idea that just hard-failed rests for a while; without this the next click
        // hopped pillars on the same idea and burned another full time budget.
        let prepared = await prepareCarouselPath(focused ? "path" : "open", blockedFromCooldown());
        // Do not lift cooldown here: clearing cooledPairs used to re-select the same
        // idea/pillar and burn another full time budget on a known-bad draft.
        if (prepared.kind === "quota") {
          // Out of time with nothing saved is a failed run; a real model quota waits for later.
          const ranOut = timeBudgetHit;
          await closeSop1(ranOut ? "failed" : "deferred", ranOut ? "time_budget" : "quota", open.length);
          return json({ ok: false, status: ranOut ? "failed" : "deferred", error: ranOut ? "time_budget" : "quota_exceeded", mode: "sop1", run_id: runId, model_calls: modelCalls, plan_count: 0, plan_ids: [] });
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
          const rested = loaded.filter((row: Record<string, unknown>) => {
            const ideaId = String(row.idea_id ?? "");
            if (cooledIdeas.has(ideaId)) return false;
            return !cooledPairs.has(`${ideaId}:${String(row.content_pillar_id ?? "")}`);
          });
          carouselPaths = orderCopyFallbackPaths(rested.length > 0 ? rested : loaded, prepared.ideaId, prepared.pillarId);
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
      const rejectedPairs = new Set<string>([
        ...cooledPairs,
        ...[...cooledIdeas].map((id) => `${id}:`),
      ]);
      const pathPair = (row: Record<string, unknown>) => `${String(row.idea_id ?? "")}:${String(row.content_pillar_id ?? "")}`;
      const pathIdeaId = (row: Record<string, unknown>) => String(row.idea_id ?? row.id ?? "");
      // Whole-idea block only via cooledIdeas or the `${id}:` sentinel from skipIdea — not every cooled pair.
      const ideaBlocked = (ideaId: string) => Boolean(ideaId) && (cooledIdeas.has(ideaId) || rejectedPairs.has(`${ideaId}:`));
      const pathBlocked = (row: Record<string, unknown>) => {
        const id = pathIdeaId(row);
        const pair = pathPair(row);
        if (ideaBlocked(id)) return true;
        return cooledPairs.has(pair) || rejectedPairs.has(pair);
      };
      // Hard reject: drop every queued pillar for this idea so the run does not reprint the same copy.
      const skipIdea = (ideaId: unknown, reason = "") => {
        const id = String(ideaId ?? "");
        if (reason) lastReject = reason.slice(0, 40);
        if (!isUuid(id)) return;
        rejectedPairs.add(`${id}:`);
        for (const row of carouselPaths) {
          if (pathIdeaId(row) === id) {
            row.skip = true;
            rejectedPairs.add(pathPair(row));
          }
        }
        if (openTurn && pathIdeaId(openTurn) === id) openTurn.skip = true;
      };
      const nextPath = () => carouselPaths.find((row) => row.used !== true && row.skip !== true && !pathBlocked(row)) ?? null;
      while (dayIndex < open.length && stop === "done") {
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
          ? withPillarMeta(String(path?.content_pillar_id ?? ""), String(path?.pillar_name ?? ""))
          : openPillar
            ? withPillarMeta(openPillar.id, openPillar.name)
            : null;
        if (!choice?.id) {
          stop = "pillar_cap";
          break;
        }
        const currentIdeaId = String(idea.idea_id ?? idea.id ?? "");
        attempt(currentIdeaId, choice.id);
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
        // Angles the latest plans keep coming back to, without the catalog, menu and brand words.
        const usedTopics = usedTopicPhrases(
          compared.flatMap((row) => [row.title, row.hook]).filter(Boolean),
          [String(service.name ?? ""), ...menus.map((row) => row.name)],
        );
        const promptPlans = compared.slice(0, 6);
        const brandLockup = brandLockupFromBrief(promptBrief, service);
        const lockupFacts = {
          websiteUrl: brandLockup.website,
          defaultContact: brandLockup.defaultContact,
          hashtags: brandLockup.hashtags,
        };
        let avoid = "";
        let plan: ReturnType<typeof parseCarouselDraft> & { service_id: string } | null = null;
        let verdict: ReturnType<typeof parseExecutionVerdict> = null;
        let executionId: string | null = null;
        if (remainingMs() < MIN_MODEL_REMAINING_MS) {
          timeBudgetHit = true;
          stop = "quota";
          break;
        }
        const draftAttempts = remainingMs() < RUN_TIME_BUDGET_MS / 2 ? MAX_DRAFT_ATTEMPTS_TIGHT : MAX_DRAFT_ATTEMPTS;
        for (let attemptNo = 1; attemptNo <= draftAttempts && stop === "done"; attemptNo += 1) {
          const drafted = await withRetry(async () => {
            // A retry after a rejected draft needs a different answer; at temperature 0 the
            // model wrote the same title three times in a row.
            const seed = openingSeed + dayIndex + attemptNo - 1;
            const systemHook = useSystemHooks ? pickSystemHook(systemHooks, seed) : null;
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
              // A rejected draft also moves to the next opening style (unless system hook wins).
              openingStyle: openingStyleFor(seed),
              usedTopics,
              systemHook,
            }), avoid ? RETRY_TEMPERATURE : 0);
            if (result.kind !== "ok") return result;
            const refSlots = referencePositions(promptBrief);
            const parsed = parseCarouselDraft(result.script, draftNotes, lockupFacts);
            if (parsed) parsed.slides = normalizeCarouselReference(parsed.slides, refSlots);
            let invalidCode = "";
            let captionMeta = null;
            if (!parsed) {
              const diagnosis = diagnoseCarouselDraftDetail(result.script, draftNotes, lockupFacts, {
                pillarId: choice.id,
                pillars,
                referenceSlots: refSlots,
              });
              invalidCode = diagnosis.code || "json";
              captionMeta = diagnosis.caption;
            } else if (!pillars.some((row) => String(row.id ?? "") === choice.id)) {
              invalidCode = "pillar";
            } else if (!carouselReferenceOk(parsed.slides, refSlots)) {
              invalidCode = "referensi";
            }
            if (invalidCode) {
              return {
                kind: "failed",
                detail: {
                  status: 0,
                  message: `invalid:${invalidCode}`,
                  caption: captionMeta,
                },
              };
            }
            parsed.post_date = day;
            parsed.content_pillar_id = choice.id;
            return { kind: "ok", script: JSON.stringify(parsed) };
          });
          if (drafted.kind === "quota") { stop = "quota"; break; }
          if (drafted.kind === "failed") {
            const failMsg = String(drafted.detail.message ?? "");
            // Structure/parse failures retry with a fix note, same as copy rejects — do not burn the idea on the first bad JSON.
            if (failMsg.startsWith("invalid:")) {
              lastReject = failMsg.slice(0, 40);
              const captionMeta = drafted.detail?.caption ?? null;
              console.log(JSON.stringify({
                event: "sop1_invalid_draft",
                run_id: runId,
                attempt: attemptNo,
                code: failMsg,
                caption_reason: captionMeta?.reason ?? null,
                caption_len: captionMeta?.caption_len ?? null,
                body_len: captionMeta?.body_len ?? null,
                has_hash: captionMeta?.has_hash ?? null,
                raw_caption_len: captionMeta?.raw_caption_len ?? null,
              }));
              if (attemptNo >= draftAttempts) {
                skipIdea(currentIdeaId, lastReject);
                break;
              }
              avoid = invalidRewriteNote(failMsg, captionMeta);
              continue;
            }
            stop = "failed";
            failure = drafted.detail;
            break;
          }
          const parsed = parseCarouselDraft(drafted.script, draftNotes, lockupFacts);
          if (!parsed) {
            const diagnosis = diagnoseCarouselDraftDetail(drafted.script, draftNotes, lockupFacts, {
              pillarId: choice.id,
              pillars,
              referenceSlots: referencePositions(promptBrief),
            });
            const code = diagnosis.code || "json";
            lastReject = `invalid:${code}`.slice(0, 40);
            console.log(JSON.stringify({
              event: "sop1_invalid_draft",
              run_id: runId,
              attempt: attemptNo,
              code: lastReject,
              caption_reason: diagnosis.caption?.reason ?? null,
              caption_len: diagnosis.caption?.caption_len ?? null,
              body_len: diagnosis.caption?.body_len ?? null,
              has_hash: diagnosis.caption?.has_hash ?? null,
              raw_caption_len: diagnosis.caption?.raw_caption_len ?? null,
              path: "post_parse",
            }));
            if (attemptNo >= draftAttempts) {
              skipIdea(currentIdeaId, lastReject);
              break;
            }
            avoid = invalidRewriteNote(lastReject, diagnosis.caption);
            continue;
          }
          const candidate = { ...parsed, post_date: day, content_pillar_id: choice.id, service_id: service.id };
          const collision = copyCollides(candidate, compared, { claimTokens });
          if (collision) {
            lastReject = `copy:${collision.field}@${String(collision.title ?? "").replace(/[^\p{L}\p{N} ]+/gu, "").slice(0, 30)}`;
            console.log(JSON.stringify({
              event: "sop1_copy_reject",
              run_id: runId,
              attempt: attemptNo,
              field: collision.field,
              prior_title: collision.title,
              prior_used: "used" in collision ? collision.used : undefined,
              draft_title: candidate.title,
              draft_opening: copyFingerprint(candidate).lines[0] ?? "",
            }));
            if (attemptNo >= draftAttempts) {
              skipIdea(currentIdeaId, lastReject);
              break;
            }
            avoid = collision.reason;
            continue;
          }
          // Slide titles are what Canva shows biggest; repeats are only logged for now.
          const repeated = headlineRepeats(candidate.slides.map((slide) => headlineFromElement(slide.element)), compared);
          if (repeated.length > 0) {
            console.log(JSON.stringify({ event: "sop1_headline_repeat", run_id: runId, attempt: attemptNo, draft_title: candidate.title, repeats: repeated.slice(0, 5) }));
          }
          if (remainingMs() < MIN_MODEL_REMAINING_MS) {
            timeBudgetHit = true;
            stop = "quota";
            break;
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
              : { kind: "failed" as const, detail: { status: 0, message: "invalid:verdict" } };
          });
          const checked = await judge(candidate);
          if (checked.kind === "quota") { stop = "quota"; break; }
          if (checked.kind === "failed") {
            const failMsg = String(checked.detail.message ?? "");
            if (failMsg.startsWith("invalid:")) {
              lastReject = failMsg.slice(0, 40);
              if (attemptNo >= draftAttempts) {
                skipIdea(currentIdeaId, lastReject);
                break;
              }
              avoid = invalidRewriteNote(failMsg);
              continue;
            }
            stop = "failed";
            failure = checked.detail;
            break;
          }
          const nextVerdict = parseExecutionVerdict(checked.script);
          if (!nextVerdict?.ok) {
            lastReject = String(nextVerdict?.check_id ?? "unparsed").slice(0, 40);
            if (attemptNo >= draftAttempts) {
              skipIdea(currentIdeaId, lastReject);
              break;
            }
            avoid = checkRewriteNote(lastReject, Array.isArray(nextVerdict?.reasons) ? nextVerdict.reasons : []);
            continue;
          }
          if (!dryRun) {
            const judged = await rpc("ai_employee_perform", {
              p_employee_id: employeeId,
              p_run_id: runId,
              p_action: "thinking.execution.check",
              p_payload: withJobClaim({
                idea_id: currentIdeaId,
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
              skipIdea(currentIdeaId, rejected);
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
        if (!plan || !verdict?.ok) {
          // Ensure the current path cannot be retried if a branch only flipped idea.skip.
          if (!ideaBlocked(currentIdeaId)) skipIdea(currentIdeaId, lastReject || "checks_failed");
          continue;
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
          skipIdea(currentIdeaId, "path_not_allowed");
          continue;
        }
        if (performed.status < 200 || performed.status >= 300 || !isUuid(createdId)) {
          console.error(JSON.stringify({
            event: "sop1_perform_failed",
            run_id: runId,
            status: performed.status,
            body: performed.body,
            caption_len: typeof planPayload?.caption === "string" ? planPayload.caption.length : null,
          }));
          throw new Error("perform_failed");
        }
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
      // Out of time with nothing saved is a failed run too; only a real model quota waits.
      const ranOut = stop === "quota" && timeBudgetHit && savedCount === 0;
      const status = stop === "quota"
        ? (ranOut ? "failed" : "deferred")
        : stop === "ideas_exhausted" && savedCount === 0
          ? "failed"
          : "succeeded";
      const label = stop === "quota"
        ? (timeBudgetHit ? "time_budget" : "quota")
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

    if (sop4) {
      const rowsOf = (value: unknown): Record<string, unknown>[] => {
        const rows = value && typeof value === "object" ? (value as { rows?: unknown }).rows : null;
        return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
      };
      const loadScope = async (scope: string, params: Record<string, string> = {}) => {
        const loaded = await rpc("ai_employee_context", {
          p_employee_id: employeeId,
          p_run_id: runId,
          p_scope: scope,
          p_params: params,
        });
        if (loaded.status < 200 || loaded.status >= 300) throw new Error("context_failed");
        return rowsOf(loaded.body);
      };
      const closeSop4 = async (status: "succeeded" | "failed" | "deferred", note: string, openCount = 0) => {
        const label = note.slice(0, 120);
        await finish(status, `sop4 ${label} open=${openCount} plans=${planIds.length} calls=${modelCalls}`);
      };
      const remainingMs = () => RUN_TIME_BUDGET_MS - (Date.now() - runStartedAt);
      type ModelResult =
        | { kind: "ok"; script: string }
        | { kind: "quota" }
        | { kind: "failed"; detail: { status: number; message: string } };
      const modelScript = async (prompt: string, temperature = 0): Promise<ModelResult> => {
        if (remainingMs() <= 0) {
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
        const detail = publicModelFailure(modelResponse.status, modelBody);
        return { kind: "failed", detail: { status: detail.status, message: detail.message } };
      };

      const storyBriefRows = await loadScope("story_brief");
      const storyBrief = storyBriefRows[0] ?? null;
      const chosenCatalog = catalogChoice(storyBrief);
      if (chosenCatalog.status === "missing") {
        await closeSop4("failed", "brief_missing");
        return json({ ok: false, error: "brief_missing", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }
      if (chosenCatalog.status === "many") {
        await closeSop4("failed", "catalog_limit");
        return json({ ok: false, error: "catalog_limit", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }

      // Days cadence: post for today (same as SOP1). Month window drives pillar rotation.
      const monthStart = `${today.slice(0, 7)}-01`;
      const [pillarRows, catalogRows, thinkingRows, planRows, monthPlanRows, performanceRows] = await Promise.all([
        loadScope("pillars"),
        loadScope("catalog"),
        loadScope("thinking"),
        loadScope("plans", { from: today, to: today }),
        loadScope("plans", { from: monthStart, to: today }),
        loadScope("performance"),
      ]);

      const service = (catalogRows.find((row) => String(row.id ?? "") === chosenCatalog.id) ?? null) as {
        id?: string;
        name?: string;
      } | null;
      if (!service?.id) {
        await closeSop4("failed", "brief_missing");
        return json({ ok: false, error: "brief_missing", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }

      const preferredPillars = new Set(
        Array.isArray(storyBrief?.pillar_ids)
          ? storyBrief.pillar_ids.filter((id: unknown) => typeof id === "string")
          : [],
      );
      const pillars = preferredPillars.size > 0
        ? pillarRows.filter((row) => preferredPillars.has(String(row.id ?? "")))
        : pillarRows;
      if (pillars.length === 0) {
        await closeSop4("failed", "no_pillars");
        return json({ ok: false, error: "no_pillars", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }

      const angleIds = Array.isArray(storyBrief?.angle_ids)
        ? storyBrief.angle_ids.filter((id: unknown): id is string => typeof id === "string" && isUuid(id))
        : [];
      let thinkingPool = thinkingRows;
      if (angleIds.length > 0) {
        const focused = thinkingRows.filter((row) => angleIds.includes(String(row.angle_id ?? "")));
        if (focused.length > 0) thinkingPool = focused;
      }
      const idea = pickUnusedIdea(thinkingPool);
      if (!idea) {
        await closeSop4("failed", "ideas_blocked");
        return json({ ok: false, error: "ideas_blocked", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }

      // Prefer least-used pillar in the month (brief-filtered pool), not alphabetical pillars[0].
      const picked = chooseSop1Pillar(pillars, monthPlanRows);
      if (!picked?.id) {
        await closeSop4("failed", "pillar_cap");
        return json({ ok: false, error: "pillar_cap", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }
      const pillarRow = pillars.find((row) => String(row.id ?? "") === picked.id) ?? pillars[0];
      const pillar = {
        id: String(picked.id),
        name: String(picked.name || pillarRow?.name || ""),
        description: String((pillarRow as { description?: string } | undefined)?.description ?? ""),
      };

      // Story jadwal harian: tanggal = hari ini (atau requestedDate), bukan nextWeekDays.
      let day = today;
      if (requestedDate) {
        const dated = resolvePostDate({ today, requestedDate, modelDate: "", plans: planRows });
        if (!dated.ok || !isDay(dated.postDate)) {
          await closeSop4("failed", "invalid_date");
          return json({ ok: false, error: "invalid_input", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
        }
        day = dated.postDate;
      }
      if (!isDay(day)) {
        await closeSop4("failed", "invalid_date");
        return json({ ok: false, error: "invalid_input", mode: "sop4", run_id: runId, model_calls: 0 }, 422);
      }
      let avoid = "";
      let draft: ReturnType<typeof readStoryDraftCandidate> = null;
      let stop: "done" | "failed" | "quota" = "done";

      for (let attempt = 0; attempt < MAX_DRAFT_ATTEMPTS; attempt += 1) {
        if (remainingMs() < MIN_MODEL_REMAINING_MS) {
          timeBudgetHit = true;
          stop = "quota";
          break;
        }
        const prompt = buildSop4Prompt({
          day,
          pillar,
          storyBrief,
          service: { id: String(service.id), name: String(service.name ?? "") },
          idea,
          thinking: thinkingPool,
          plans: planRows,
          performance: performanceRows,
          avoid,
        });
        const temperature = attempt === 0 ? 0 : RETRY_TEMPERATURE;
        const drafted = await modelScript(prompt, temperature);
        if (drafted.kind === "quota") {
          stop = "quota";
          break;
        }
        if (drafted.kind !== "ok") {
          stop = "failed";
          break;
        }
        const candidate = readStoryDraftCandidate(drafted.script);
        if (!candidate) {
          avoid = "JSON Story tidak valid. Ikuti kunci yang diminta.";
          continue;
        }
        candidate.content_pillar_id = String(pillar.id ?? "");
        candidate.service_id = String(service.id);
        candidate.post_date = day;
        const diagnose = diagnoseStoryDraftDetail(candidate);
        if (diagnose) {
          avoid = diagnose;
          continue;
        }
        draft = candidate;
        break;
      }

      if (stop === "quota") {
        await closeSop4("deferred", timeBudgetHit ? "time_budget" : "quota_exceeded");
        return json({
          ok: false,
          mode: "sop4",
          status: "deferred",
          error: timeBudgetHit ? "time_budget" : "quota_exceeded",
          run_id: runId,
          model_calls: modelCalls,
          plan_count: 0,
          plan_ids: [],
        });
      }
      if (stop === "failed" || !draft) {
        await closeSop4("failed", "model_failed");
        return json({
          ok: false,
          mode: "sop4",
          status: "failed",
          error: "model_failed",
          run_id: runId,
          model_calls: modelCalls,
          plan_count: 0,
          plan_ids: [],
        });
      }

      if (dryRun) {
        await closeSop4("succeeded", "dry_run");
        return json({
          ok: true,
          mode: "sop4",
          status: "succeeded",
          dry_run: true,
          run_id: runId,
          model_calls: modelCalls,
          plan_count: 1,
          plan_ids: [],
          drafts: [draft],
        });
      }

      let verdict: ReturnType<typeof parseExecutionVerdict> = null;
      for (let checkAttempt = 0; checkAttempt < 2; checkAttempt += 1) {
        if (!draft) break;
        if (remainingMs() < MIN_MODEL_REMAINING_MS) {
          timeBudgetHit = true;
          break;
        }
        const checked = await modelScript(buildStoryExecutionCheckPrompt({
          day,
          pillar,
          idea,
          draft,
        }), 0);
        if (checked.kind === "quota") {
          await closeSop4("deferred", "quota_exceeded");
          return json({
            ok: false,
            mode: "sop4",
            status: "deferred",
            error: "quota_exceeded",
            run_id: runId,
            model_calls: modelCalls,
            plan_count: 0,
            plan_ids: [],
          });
        }
        if (checked.kind !== "ok") {
          await closeSop4("failed", "model_failed");
          return json({ ok: false, mode: "sop4", status: "failed", error: "model_failed", run_id: runId, model_calls: modelCalls }, 422);
        }
        verdict = parseExecutionVerdict(checked.script);
        if (verdict?.ok) break;

        const failNote = [
          verdict?.check_id ? String(verdict.check_id) : "checks_failed",
          ...(Array.isArray(verdict?.reasons) ? verdict.reasons : []),
        ].filter(Boolean).join("; ").slice(0, 280);
        if (checkAttempt >= 1 || remainingMs() < MIN_MODEL_REMAINING_MS) {
          await closeSop4("failed", failNote || "checks_failed");
          return json({
            ok: false,
            mode: "sop4",
            status: "failed",
            error: "checks_failed",
            run_id: runId,
            model_calls: modelCalls,
            check_id: verdict?.check_id ?? null,
            reasons: verdict?.reasons ?? [],
          }, 422);
        }

        // One rewrite after check fail, then re-check (Story-specific prompt).
        const rewritePrompt = buildSop4Prompt({
          day,
          pillar,
          storyBrief,
          service: { id: String(service.id), name: String(service.name ?? "") },
          idea,
          thinking: thinkingPool,
          plans: planRows,
          performance: performanceRows,
          avoid: failNote || "Perbaiki draf agar lulus cek Story.",
        });
        const rewritten = await modelScript(rewritePrompt, RETRY_TEMPERATURE);
        if (rewritten.kind !== "ok") {
          await closeSop4("failed", failNote || "checks_failed");
          return json({
            ok: false,
            mode: "sop4",
            status: "failed",
            error: "checks_failed",
            run_id: runId,
            model_calls: modelCalls,
            check_id: verdict?.check_id ?? null,
            reasons: verdict?.reasons ?? [],
          }, 422);
        }
        const next = readStoryDraftCandidate(rewritten.script);
        if (!next || diagnoseStoryDraftDetail(next)) {
          await closeSop4("failed", failNote || "checks_failed");
          return json({
            ok: false,
            mode: "sop4",
            status: "failed",
            error: "checks_failed",
            run_id: runId,
            model_calls: modelCalls,
            check_id: verdict?.check_id ?? null,
            reasons: verdict?.reasons ?? [],
          }, 422);
        }
        next.content_pillar_id = String(pillar.id ?? "");
        next.service_id = String(service.id);
        next.post_date = day;
        draft = next;
      }

      if (timeBudgetHit && !verdict?.ok) {
        await closeSop4("deferred", "time_budget");
        return json({
          ok: false,
          mode: "sop4",
          status: "deferred",
          error: "time_budget",
          run_id: runId,
          model_calls: modelCalls,
          plan_count: 0,
          plan_ids: [],
        });
      }
      if (!verdict?.ok || !draft) {
        await closeSop4("failed", "checks_failed");
        return json({
          ok: false,
          mode: "sop4",
          status: "failed",
          error: "checks_failed",
          run_id: runId,
          model_calls: modelCalls,
          check_id: verdict?.check_id ?? null,
          reasons: verdict?.reasons ?? [],
        }, 422);
      }

      const judged = await rpc("ai_employee_perform", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_action: "thinking.execution.check",
        p_payload: withJobClaim({
          idea_id: String(idea.idea_id ?? idea.id ?? ""),
          content_pillar_id: draft.content_pillar_id,
          statement: verdict.statement,
          checks: verdict.checks,
          facts: verdict.facts,
          script: verdict.script,
        }, claimToken),
      });
      const accepted = judged.body && typeof judged.body === "object"
        ? (judged.body as { accepted?: unknown; execution_id?: unknown })
        : null;
      const executionId = accepted?.execution_id;
      if (judged.status < 200 || judged.status >= 300 || accepted?.accepted !== true || !isUuid(executionId)) {
        await closeSop4("failed", "execution_failed");
        return json({ ok: false, mode: "sop4", status: "failed", error: "execution_failed", run_id: runId, model_calls: modelCalls }, 422);
      }

      const palette = storyPalette(storyBrief);
      const performed = await rpc("ai_employee_perform", {
        p_employee_id: employeeId,
        p_run_id: runId,
        p_action: "thinking.plan.save",
        p_payload: withJobClaim({
          content_kind: "story",
          title: draft.title,
          post_date: draft.post_date,
          caption: draft.caption,
          concept: draft.concept,
          visual: draft.visual,
          headline: draft.headline,
          content_pillar_id: draft.content_pillar_id,
          service_id: draft.service_id,
          headline_font: String(storyBrief?.headline_font ?? ""),
          body_font: String(storyBrief?.body_font ?? ""),
          ...(palette ? { palette } : {}),
          idea_id: String(idea.idea_id ?? idea.id ?? ""),
          execution_id: executionId,
        }, claimToken),
      });
      const createdId = performed.body && typeof performed.body === "object"
        ? (performed.body as { id?: unknown }).id
        : null;
      if (performed.status < 200 || performed.status >= 300 || !isUuid(createdId)) {
        console.error(JSON.stringify({
          event: "sop4_perform_failed",
          run_id: runId,
          status: performed.status,
          body: performed.body,
        }));
        await closeSop4("failed", "perform_failed");
        return json({ ok: false, mode: "sop4", status: "failed", error: "perform_failed", run_id: runId, model_calls: modelCalls }, 422);
      }
      planIds.push(String(createdId));
      await closeSop4("succeeded", "ok");
      return json({
        ok: true,
        mode: "sop4",
        status: "succeeded",
        run_id: runId,
        model_calls: modelCalls,
        plan_count: planIds.length,
        plan_ids: planIds,
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
