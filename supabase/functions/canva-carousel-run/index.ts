/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCanvaCarouselBrief, carouselSlidesFromBrief } from "../_shared/canvaCarouselBrief.ts";
import { callCanvaTool, listCanvaMcpTools } from "../_shared/canvaMcp.ts";
import { readCanvaToolJson } from "../_shared/canvaMcpParse.ts";
import { getCanvaAccessToken } from "../_shared/canvaToken.ts";
import { reviseCarousel } from "./revise.ts";

const POLL_BUDGET_MS = 100_000;
const EXPORT_POLL_MS = 45_000;
const CAROUSEL_BUCKET = "social-media-carousel";
const USER_INTENT = "membuat carousel yang bisa diedit";
const PORTRAIT_FORMAT = "Instagram Post (Portrait)";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function secretMatches(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

function publicError(value: unknown): string {
  const text = String(value instanceof Error ? value.message : value ?? "canva_failed")
    .replace(/sbp_[A-Za-z0-9]+/g, "")
    .replace(/eyJ[A-Za-z0-9_-]{8,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 160) || "canva_failed";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readJob(payload: Record<string, unknown>) {
  const job = asRecord(payload.job) ?? payload;
  const design = asRecord(job.design ?? payload.design);
  const policy = asRecord(job.polling_policy ?? payload.polling_policy);
  const failure = asRecord(job.failure ?? payload.failure);
  const wait = Number(policy?.wait_seconds ?? 15);
  return {
    status: String(job.status ?? payload.status ?? "").trim().toLowerCase(),
    jobId: String(job.job_id ?? payload.job_id ?? "").trim(),
    token: String(job.continuation_token ?? payload.continuation_token ?? "").trim(),
    wait: Number.isFinite(wait) && wait > 0 ? wait : 15,
    designId: String(design?.id ?? "").trim(),
    designUrl: String(design?.url ?? design?.edit_url ?? "").trim(),
    failureMessage: String(failure?.message ?? failure?.code ?? "").trim(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exportError(value: unknown): string {
  const message = publicError(value);
  if (/https?:/i.test(message)) return "export_failed";
  return message;
}

function readExport(payload: Record<string, unknown>) {
  const job = asRecord(payload.job) ?? payload;
  const urls = Array.isArray(job.urls)
    ? job.urls.filter((value): value is string => typeof value === "string" && value.startsWith("https://"))
    : [];
  return {
    status: String(job.status ?? payload.status ?? "").trim().toLowerCase(),
    jobId: String(job.id ?? job.job_id ?? payload.id ?? "").trim(),
    urls,
  };
}

async function downloadJpeg(url: string): Promise<Uint8Array> {
  if (!url.startsWith("https://")) throw new Error("export_download_failed");
  const response = await fetch(url);
  if (!response.ok) throw new Error("export_download_failed");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 3 || bytes.byteLength > 20_000_000) throw new Error("export_not_jpeg");
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error("export_not_jpeg");
  return bytes;
}

async function markFailed(admin: SupabaseClient, planId: string, error: string): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("canva_carousel_runs")
    .update({ status: "failed", error: publicError(error), finished_at: now, updated_at: now })
    .eq("social_media_plan_id", planId)
    .neq("status", "succeeded");
}

async function markSucceeded(
  admin: SupabaseClient,
  planId: string,
  designId: string,
  designUrl: string,
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("canva_carousel_runs")
    .update({
      status: "succeeded",
      design_id: designId,
      design_url: designUrl,
      error: null,
      continuation_token: null,
      finished_at: now,
      updated_at: now,
    })
    .eq("social_media_plan_id", planId);
}

async function saveJob(
  admin: SupabaseClient,
  planId: string,
  jobId: string,
  continuationToken: string,
): Promise<void> {
  await admin
    .from("canva_carousel_runs")
    .update({
      status: "running",
      canva_job_id: jobId,
      continuation_token: continuationToken || null,
      updated_at: new Date().toISOString(),
    })
    .eq("social_media_plan_id", planId)
    .neq("status", "succeeded");
}

async function accessToken(admin: SupabaseClient, organizationId: string, forceRefresh = false): Promise<string> {
  return await getCanvaAccessToken(admin, organizationId, { forceRefresh });
}

async function callRaw(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ token: string; payload: Record<string, unknown> }> {
  try {
    const raw = await callCanvaTool(token, name, args);
    return { token, payload: readCanvaToolJson(raw) };
  } catch (error) {
    if (publicError(error) !== "canva_unauthorized") throw error;
    const refreshed = await accessToken(admin, organizationId, true);
    const raw = await callCanvaTool(refreshed, name, args);
    return { token: refreshed, payload: readCanvaToolJson(raw) };
  }
}

async function startRestExport(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  designId: string,
  pages: number[],
): Promise<{ token: string; job: ReturnType<typeof readExport> }> {
  const format: Record<string, unknown> = { type: "jpg", quality: 90 };
  if (pages.length > 0) format.pages = pages;
  const send = (access: string) => fetch("https://api.canva.com/rest/v1/exports", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ design_id: designId, format }),
  });
  let current = token;
  let response = await send(current);
  if (response.status === 401) {
    current = await accessToken(admin, organizationId, true);
    response = await send(current);
  }
  if (!response.ok) throw new Error(`export_http_${response.status}`);
  return { token: current, job: readExport(asRecord(await response.json()) ?? {}) };
}

async function pollExport(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  jobId: string,
): Promise<string[]> {
  const deadline = Date.now() + EXPORT_POLL_MS;
  let current = token;
  let waitSeconds = 2;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    await sleep(Math.min(waitSeconds, 10, Math.floor(remaining / 1000)) * 1000);
    const response = await fetch(`https://api.canva.com/rest/v1/exports/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${current}` },
    });
    if (response.status === 401) {
      current = await accessToken(admin, organizationId, true);
      continue;
    }
    if (!response.ok) throw new Error("export_poll_failed");
    const job = readExport(asRecord(await response.json()) ?? {});
    if ((job.status === "success" || job.status === "completed") && job.urls.length > 0) return job.urls;
    if (job.status === "failed") throw new Error("export_failed");
    waitSeconds = 5;
  }
  throw new Error("export_pending");
}

async function exportCarouselImages(
  admin: SupabaseClient,
  planId: string,
  organizationId: string,
): Promise<void> {
  try {
    const { data: run } = await admin
      .from("canva_carousel_runs")
      .select("status, images_ready, export_attempts, design_id, updated_at, refresh_requested, revision_requested, review_after_export")
      .eq("social_media_plan_id", planId)
      .maybeSingle();
    if (!run || run.status !== "succeeded" || run.images_ready || !run.design_id || run.revision_requested === true) return;
    if (Number(run.export_attempts) >= 3) {
      if (run.refresh_requested === true) {
        await admin
          .from("canva_carousel_runs")
          .update({
            images_ready: true,
            refresh_requested: false,
            review_after_export: false,
            error: "export_failed",
            updated_at: new Date().toISOString(),
          })
          .eq("social_media_plan_id", planId)
          .eq("status", "succeeded");
      }
      return;
    }

    const replace = run.refresh_requested === true;
    const { count } = await admin
      .from("social_media_plan_carousel_images")
      .select("id", { count: "exact", head: true })
      .eq("social_media_plan_id", planId);
    const hadImages = (count ?? 0) > 0;
    if (!replace && hadImages) {
      await admin
        .from("canva_carousel_runs")
        .update({ images_ready: true, refresh_requested: false, error: null, updated_at: new Date().toISOString() })
        .eq("social_media_plan_id", planId);
      return;
    }

    const now = new Date().toISOString();
    const { data: locked } = await admin
      .from("canva_carousel_runs")
      .update({
        updated_at: now,
        export_attempts: Number(run.export_attempts ?? 0) + 1,
        error: null,
      })
      .eq("social_media_plan_id", planId)
      .eq("updated_at", run.updated_at)
      .eq("images_ready", false)
      .select("export_attempts, design_id")
      .maybeSingle();
    if (!locked?.design_id) return;

    const uploaded: string[] = [];
    let inserted = false;
    try {
      let token = await accessToken(admin, organizationId);
      const formatsCall = await callRaw(admin, organizationId, token, "get-export-formats", {
        design_id: locked.design_id,
      });
      token = formatsCall.token;
      const jpg = asRecord(asRecord(formatsCall.payload.formats)?.jpg);
      if (!jpg) throw new Error("export_format_missing");
      const pages = Array.isArray(jpg.page_numbers)
        ? jpg.page_numbers
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0)
          .slice(0, 10)
        : [];
      const exportArgs: Record<string, unknown> = {
        design_id: locked.design_id,
        format: "jpg",
        quality: 90,
      };
      if (pages.length > 0) exportArgs.pages = pages;
      const exported = await callRaw(admin, organizationId, token, "export-design", exportArgs);
      token = exported.token;
      let job = readExport(exported.payload);
      if (job.status === "failed" || (job.urls.length === 0 && !job.jobId)) {
        const rest = await startRestExport(admin, organizationId, token, String(locked.design_id), pages);
        token = rest.token;
        job = rest.job;
      }
      let urls = job.urls;
      if (job.status === "failed") throw new Error("export_failed");
      if (urls.length === 0) {
        if (!job.jobId) throw new Error("export_failed");
        urls = await pollExport(admin, organizationId, token, job.jobId);
      }
      urls = urls.slice(0, 10);
      if (urls.length === 0) throw new Error("export_empty");

      for (const url of urls) {
        const bytes = await downloadJpeg(url);
        const path = `${organizationId}/${planId}/${crypto.randomUUID()}.jpg`;
        const { error } = await admin.storage.from(CAROUSEL_BUCKET).upload(
          path,
          new Blob([bytes], { type: "image/jpeg" }),
          { contentType: "image/jpeg", upsert: false },
        );
        if (error) throw new Error("carousel_upload_failed");
        uploaded.push(path);
      }

      const { data: previousPaths, error: swapError } = await admin.rpc("canva_carousel_replace_images", {
        p_plan_id: planId,
        p_paths: uploaded,
      });
      if (swapError) throw new Error("carousel_insert_failed");
      inserted = true;
      const oldPaths = Array.isArray(previousPaths)
        ? previousPaths.map((path) => String(path)).filter((path) => path && !uploaded.includes(path))
        : [];
      if (oldPaths.length > 0) {
        await admin.storage.from(CAROUSEL_BUCKET).remove(oldPaths);
      }
      if (run.review_after_export === true) {
        await admin
          .from("social_media_plans")
          .update({
            production_status: "Need Review",
            production_completion_date: new Date().toISOString(),
          })
          .eq("id", planId)
          .eq("production_status", "Request Revision");
      }
      await admin
        .from("canva_carousel_runs")
        .update({
          images_ready: true,
          refresh_requested: false,
          review_after_export: false,
          revision_requested: false,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("social_media_plan_id", planId);
    } catch (error) {
      if (!inserted && uploaded.length > 0) {
        await admin.storage.from(CAROUSEL_BUCKET).remove(uploaded);
      }
      if (inserted) {
        if (run.review_after_export === true) {
          await admin
            .from("social_media_plans")
            .update({
              production_status: "Need Review",
              production_completion_date: new Date().toISOString(),
            })
            .eq("id", planId)
            .eq("production_status", "Request Revision");
        }
        await admin
          .from("canva_carousel_runs")
          .update({
            images_ready: true,
            refresh_requested: false,
            review_after_export: false,
            revision_requested: false,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("social_media_plan_id", planId)
          .eq("status", "succeeded");
        return;
      }
      const message = exportError(error);
      const attempts = Number(locked.export_attempts ?? 1);
      const stillTrying = message === "export_pending" && attempts < 3;
      await admin
        .from("canva_carousel_runs")
        .update({
          error: stillTrying ? null : message,
          images_ready: stillTrying ? false : hadImages,
          refresh_requested: stillTrying ? replace : false,
          review_after_export: stillTrying ? run.review_after_export === true : false,
          updated_at: new Date().toISOString(),
        })
        .eq("social_media_plan_id", planId)
        .eq("status", "succeeded");
    }
  } catch {
    // The finished design stays. The resume cron can try the export again.
  }
}

async function callTool(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ token: string; job: ReturnType<typeof readJob> }> {
  try {
    const raw = await callCanvaTool(token, name, args);
    return { token, job: readJob(readCanvaToolJson(raw)) };
  } catch (error) {
    if (publicError(error) !== "canva_unauthorized") throw error;
    const refreshed = await accessToken(admin, organizationId, true);
    const raw = await callCanvaTool(refreshed, name, args);
    return { token: refreshed, job: readJob(readCanvaToolJson(raw)) };
  }
}

async function pollJob(
  admin: SupabaseClient,
  planId: string,
  organizationId: string,
  token: string,
  jobId: string,
  continuationToken: string,
): Promise<"succeeded" | "running"> {
  const deadline = Date.now() + POLL_BUDGET_MS;
  let currentToken = token;
  let nextContinuation = continuationToken;
  let waitSeconds = 2;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    await sleep(Math.min(Math.max(waitSeconds, 2), 20, Math.floor(remaining / 1000)) * 1000);
    const called = await callTool(admin, organizationId, currentToken, "get-create-design-async-job", {
      job_id: jobId,
      ...(nextContinuation ? { continuation_token: nextContinuation } : {}),
    });
    currentToken = called.token;
    const job = called.job;
    if (job.token) nextContinuation = job.token;
    if (job.status === "completed" || job.status === "success") {
      if (!job.designUrl.startsWith("https://")) throw new Error("design_missing");
      await markSucceeded(admin, planId, job.designId, job.designUrl);
      return "succeeded";
    }
    if (job.status === "failed") throw new Error(job.failureMessage || "canva_failed");
    waitSeconds = job.wait;
    await saveJob(admin, planId, jobId, nextContinuation);
  }
  await saveJob(admin, planId, jobId, nextContinuation);
  return "running";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const internalSecret = Deno.env.get("SCHEDULED_POSTS_INTERNAL_SECRET") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !internalSecret) return json({ error: "misconfigured" }, 500);
  if (!secretMatches(req.headers.get("x-synckerja-internal-secret") ?? "", internalSecret)) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const planId = String(body.plan_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return json({ error: "invalid_input" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: run, error: runError } = await admin
    .from("canva_carousel_runs")
    .select("status, canva_job_id, continuation_token, attempts, updated_at, organization_id, images_ready, revision_requested")
    .eq("social_media_plan_id", planId)
    .maybeSingle();
  if (runError || !run) return json({ error: "missing" }, 404);
  if (run.status === "succeeded") {
    if (run.revision_requested === true) {
      await reviseCarousel(
        admin,
        planId,
        String(run.organization_id),
        () => exportCarouselImages(admin, planId, String(run.organization_id)),
      );
      return json({ ok: true, status: "succeeded" });
    }
    if (run.images_ready !== true) {
      await exportCarouselImages(admin, planId, String(run.organization_id));
    }
    return json({ ok: true, status: "succeeded" });
  }

  const updatedAt = new Date(String(run.updated_at ?? 0)).getTime();
  const freshRunning = run.status === "running" && Number.isFinite(updatedAt) && Date.now() - updatedAt < 90_000;
  if (freshRunning && !run.canva_job_id) return json({ ok: true, status: "running" });

  try {
    if (run.canva_job_id && (run.status === "running" || run.status === "queued")) {
      const lockedAt = new Date().toISOString();
      const { data: locked } = await admin
        .from("canva_carousel_runs")
        .update({ status: "running", updated_at: lockedAt })
        .eq("social_media_plan_id", planId)
        .eq("updated_at", run.updated_at)
        .select("canva_job_id, continuation_token")
        .maybeSingle();
      if (!locked?.canva_job_id) return json({ ok: true, status: "running" });
      const outcome = await pollJob(
        admin,
        planId,
        String(run.organization_id),
        await accessToken(admin, String(run.organization_id)),
        String(locked.canva_job_id),
        String(locked.continuation_token ?? ""),
      );
      if (outcome === "succeeded") {
        await exportCarouselImages(admin, planId, String(run.organization_id));
      }
      return json({ ok: true, status: outcome });
    }

    const now = new Date().toISOString();
    const claimPatch = {
      status: "running",
      error: null,
      finished_at: null,
      started_at: now,
      updated_at: now,
      attempts: Number(run.attempts ?? 0) + 1,
    };
    let claimed = (await admin
      .from("canva_carousel_runs")
      .update(claimPatch)
      .eq("social_media_plan_id", planId)
      .in("status", ["queued", "failed"])
      .select("attempts")
      .maybeSingle()).data;
    if (!claimed && run.status === "running" && !run.canva_job_id) {
      claimed = (await admin
        .from("canva_carousel_runs")
        .update(claimPatch)
        .eq("social_media_plan_id", planId)
        .eq("status", "running")
        .is("canva_job_id", null)
        .eq("updated_at", run.updated_at)
        .select("attempts")
        .maybeSingle()).data;
    }
    if (!claimed) return json({ ok: true, status: "running" });
    if (Number(claimed.attempts) > 4) {
      await markFailed(admin, planId, "canva_attempt_limit");
      return json({ ok: false, status: "failed" });
    }

    const { data: plan } = await admin
      .from("social_media_plans")
      .select("organization_id, title, brief, approved, pic_id, content_type_id")
      .eq("id", planId)
      .maybeSingle();
    if (!plan?.approved) {
      await markFailed(admin, planId, "not_approved");
      return json({ ok: false, status: "failed" });
    }
    const { data: employee } = await admin
      .from("employees")
      .select("is_ai, organization_id")
      .eq("id", plan.pic_id)
      .maybeSingle();
    if (!employee?.is_ai || employee.organization_id !== plan.organization_id) {
      await markFailed(admin, planId, "not_ai_pic");
      return json({ ok: false, status: "failed" });
    }
    const { data: contentType } = await admin
      .from("content_types")
      .select("name")
      .eq("id", plan.content_type_id)
      .maybeSingle();
    if (String(contentType?.name ?? "").trim().toLowerCase() !== "carousel") {
      await markFailed(admin, planId, "not_carousel");
      return json({ ok: false, status: "failed" });
    }

    const slides = carouselSlidesFromBrief(String(plan.brief ?? ""));
    if (slides.length < 2) {
      await markFailed(admin, planId, "slides_missing");
      return json({ ok: false, status: "failed" });
    }
    const { data: captions } = await admin
      .from("brief_captions")
      .select("content")
      .eq("social_media_plan_id", planId)
      .limit(1);
    const brief = buildCanvaCarouselBrief({
      title: String(plan.title ?? ""),
      caption: String(captions?.[0]?.content ?? ""),
      slides,
    });

    const organizationId = String(plan.organization_id);
    let token = await accessToken(admin, organizationId);
    let tools: string[] = [];
    try {
      tools = await listCanvaMcpTools(token);
    } catch (error) {
      if (publicError(error) !== "canva_unauthorized") throw error;
      token = await accessToken(admin, organizationId, true);
      tools = await listCanvaMcpTools(token);
    }
    if (!tools.some((name) => name.toLowerCase() === "create-design")) {
      await markFailed(admin, planId, "canva_tool_missing");
      return json({ ok: false, status: "failed" });
    }

    let created;
    let retriedWithoutFormat = false;
    try {
      created = await callTool(admin, organizationId, token, "create-design", {
        brief,
        format: PORTRAIT_FORMAT,
        user_intent: USER_INTENT,
      });
    } catch (error) {
      if (!/format|portrait|design type/i.test(publicError(error))) throw error;
      retriedWithoutFormat = true;
      created = await callTool(admin, organizationId, token, "create-design", {
        brief,
        user_intent: USER_INTENT,
      });
    }
    token = created.token;
    const formatRejected = !retriedWithoutFormat
      && created.job.status === "failed"
      && /format|portrait|design type/i.test(created.job.failureMessage);
    if (formatRejected) {
      created = await callTool(admin, organizationId, token, "create-design", {
        brief,
        user_intent: USER_INTENT,
      });
      token = created.token;
    }
    if (created.job.status === "failed" || !created.job.jobId) {
      await markFailed(admin, planId, created.job.failureMessage || "canva_failed");
      return json({ ok: false, status: "failed" });
    }
    if (created.job.status === "completed" || created.job.status === "success") {
      if (!created.job.designUrl.startsWith("https://")) throw new Error("design_missing");
      await markSucceeded(admin, planId, created.job.designId, created.job.designUrl);
      await exportCarouselImages(admin, planId, organizationId);
      return json({ ok: true, status: "succeeded" });
    }
    await saveJob(admin, planId, created.job.jobId, created.job.token);
    const outcome = await pollJob(
      admin,
      planId,
      organizationId,
      token,
      created.job.jobId,
      created.job.token,
    );
    if (outcome === "succeeded") await exportCarouselImages(admin, planId, organizationId);
    return json({ ok: true, status: outcome });
  } catch (error) {
    const message = publicError(error);
    if (message === "design_missing") {
      await markFailed(admin, planId, message);
      return json({ ok: false, status: "failed" });
    }
    const { data: current } = await admin
      .from("canva_carousel_runs")
      .select("canva_job_id, continuation_token, status")
      .eq("social_media_plan_id", planId)
      .maybeSingle();
    if (current?.canva_job_id && current.status !== "succeeded") {
      await saveJob(admin, planId, String(current.canva_job_id), String(current.continuation_token ?? ""));
      return json({ ok: false, status: "running" });
    }
    await markFailed(admin, planId, message);
    return json({ ok: false, status: "failed" });
  }
});
