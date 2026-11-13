/// <reference path="../edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCanvaCarouselBrief, carouselPalette, carouselReferencePosition, carouselSlidesFromBrief, layoutOnlyDescription } from "../_shared/canvaCarouselBrief.ts";
import { callCanvaTool, canvaEditingMode, listCanvaMcpTools, type CanvaEditingMode } from "../_shared/canvaMcp.ts";
import { readCanvaToolJson } from "../_shared/canvaMcpParse.ts";
import { getCanvaAccessToken } from "../_shared/canvaToken.ts";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { reviseCarousel } from "./revise.ts";

const POLL_BUDGET_MS = 100_000;
const EXPORT_POLL_MS = 45_000;
const CAROUSEL_BUCKET = "social-media-carousel";
const REFERENCE_BUCKET = "ai-employee-references";
const USER_INTENT = "carousel 4:5 yang mengikuti naskah, layout referensi, dan warna katalog";
const LOGO_BUCKET = "digital-asset-company-logos";
const MAX_PRODUCT_PHOTOS = 8;
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
      images_ready: false,
      refresh_requested: true,
      logo_placed: false,
      export_attempts: 0,
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

async function stampLogoOnSlide(jpeg: Uint8Array, logo: Uint8Array): Promise<Uint8Array> {
  const page = await Image.decode(jpeg);
  const decoded = await Image.decode(logo);
  const shortSide = Math.min(page.width, page.height);
  const target = Math.max(72, Math.round(shortSide * 0.16));
  const scale = target / Math.max(decoded.width, decoded.height);
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const mark = decoded.resize(width, height);
  let maxAlpha = 0;
  for (let index = 3; index < mark.bitmap.length; index += 4) {
    if (mark.bitmap[index] > maxAlpha) maxAlpha = mark.bitmap[index];
  }
  if (maxAlpha === 0) {
    for (let index = 3; index < mark.bitmap.length; index += 4) mark.bitmap[index] = 255;
  }
  const pad = Math.round(target * 0.12);
  const plate = new Image(width + pad * 2, height + pad * 2);
  plate.fill(Image.rgbaToColor(255, 255, 255, 255));
  const left = Math.round((page.width - width) / 2);
  const top = Math.round(shortSide * 0.03);
  page.composite(plate, left - pad, top - pad);
  page.composite(mark, left, top);
  return await page.encodeJPEG(90);
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> | null {
  return asRecord(asRecord(value)?.[key]);
}

function logoAssetId(payload: Record<string, unknown>): string {
  const job = asRecord(payload.job) ?? payload;
  const asset = asRecord(job.asset) ?? asRecord(payload.asset) ?? asRecord(job.media) ?? asRecord(payload.media);
  // upload-asset-from-url now answers with media_id; older answers used asset_id.
  const id = String(
    payload.media_id ?? job.media_id ?? job.asset_id ?? payload.asset_id ?? asset?.id ?? "",
  ).trim();
  return /^[a-zA-Z0-9_-]{1,50}$/.test(id) ? id : "";
}

type EditPage = { id: string; pageNumber: number; width: number; height: number; responsive: boolean };
type EditSession = {
  mode: CanvaEditingMode;
  transactionId: string;
  pages: EditPage[];
  /** Legacy perform-editing-operations wants the pages it returned last. */
  rawPages: unknown[];
};

async function editingModeFor(admin: SupabaseClient, organizationId: string, token: string): Promise<{ token: string; mode: CanvaEditingMode }> {
  try {
    return { token, mode: canvaEditingMode(await listCanvaMcpTools(token)) };
  } catch (error) {
    if (publicError(error) !== "canva_unauthorized") throw error;
    const refreshed = await accessToken(admin, organizationId, true);
    return { token: refreshed, mode: canvaEditingMode(await listCanvaMcpTools(refreshed)) };
  }
}

function readEditPages(rows: unknown[]): EditPage[] {
  return rows.flatMap((item, index) => {
    const page = asRecord(item);
    const id = String(page?.page_id ?? page?.id ?? "").trim();
    const listed = Number(page?.page_number ?? page?.page_index ?? page?.index ?? 0);
    const number = Number.isInteger(listed) && listed >= 1 ? listed : index + 1;
    const size = asRecord(page?.dimensions) ?? asRecord(page?.dimension) ?? {};
    if (!id) return [];
    return [{
      id,
      pageNumber: number,
      width: Number(size.width) > 0 ? Number(size.width) : 1080,
      height: Number(size.height) > 0 ? Number(size.height) : 1350,
      responsive: page?.is_responsive === true || page?.type === "responsive",
    }];
  });
}

/**
 * Opens an editing transaction with whichever tool set this Canva MCP lists:
 * start-editing-transaction (legacy, used by this app so far) or read-design
 * with open_transaction (current).
 */
async function openEditing(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  designId: string,
  intent: string,
): Promise<{ token: string; session: EditSession }> {
  const detected = await editingModeFor(admin, organizationId, token);
  if (detected.mode === "legacy") {
    const started = await callRaw(admin, organizationId, detected.token, "start-editing-transaction", {
      design_id: designId,
      user_intent: intent,
    });
    const rawPages = Array.isArray(started.payload.pages) ? started.payload.pages : [];
    const transactionId = String(
      started.payload.transaction_id ?? nestedRecord(started.payload, "transaction")?.id
        ?? nestedRecord(started.payload, "transaction")?.transaction_id ?? "",
    ).trim();
    return { token: started.token, session: { mode: "legacy", transactionId, pages: readEditPages(rawPages), rawPages } };
  }
  const opened = await callRaw(admin, organizationId, detected.token, "read-design", {
    design_id: designId,
    open_transaction: true,
    filter: { fields: ["page_metadata"] },
    user_intent: intent,
  });
  const transaction = asRecord(opened.payload.transaction);
  const transactionId = String(transaction?.transaction_id ?? opened.payload.transaction_id ?? "").trim();
  const rows = Array.isArray(opened.payload.page_metadata) ? opened.payload.page_metadata : [];
  return { token: opened.token, session: { mode: "current", transactionId, pages: readEditPages(rows), rawPages: [] } };
}

function editFailed(payload: Record<string, unknown>): boolean {
  if (String(payload.status ?? "").toLowerCase() === "failed") return true;
  const results = payload.edit_operation_results ?? payload.operation_results;
  return Array.isArray(results) && results.some((result) => {
    const status = String(asRecord(result)?.status ?? "").toLowerCase();
    return status === "failed" || status === "failure" || status === "error";
  });
}

async function editPage(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  session: EditSession,
  pageNumber: number,
  operations: Record<string, unknown>[],
  intent: string,
): Promise<{ token: string; ok: boolean }> {
  if (session.mode === "legacy") {
    const edited = await callRaw(admin, organizationId, token, "perform-editing-operations", {
      transaction_id: session.transactionId,
      pages: session.rawPages,
      page_index: pageNumber,
      operations,
      user_intent: intent,
    });
    if (Array.isArray(edited.payload.pages)) session.rawPages = edited.payload.pages;
    return { token: edited.token, ok: !editFailed(edited.payload) };
  }
  const edited = await callRaw(admin, organizationId, token, "edit-design", {
    transaction_id: session.transactionId,
    page_index: pageNumber,
    finalize: "keep_open",
    operations,
    user_intent: intent,
  });
  return { token: edited.token, ok: !editFailed(edited.payload) };
}

async function finishEditing(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  session: EditSession,
  finalize: "commit" | "cancel",
  intent: string,
): Promise<{ token: string; ok: boolean }> {
  const done = session.mode === "legacy"
    ? await callRaw(admin, organizationId, token, finalize === "commit" ? "commit-editing-transaction" : "cancel-editing-transaction", {
      transaction_id: session.transactionId,
      user_intent: intent,
    })
    : await callRaw(admin, organizationId, token, "edit-design", {
      transaction_id: session.transactionId,
      finalize,
      user_intent: intent,
    });
  return { token: done.token, ok: !editFailed(done.payload) };
}

async function pollLogoUpload(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  jobId: string,
): Promise<string> {
  const deadline = Date.now() + 40_000;
  let current = token;
  while (Date.now() < deadline) {
    await sleep(2000);
    const response = await fetch(`https://api.canva.com/rest/v1/url-asset-uploads/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${current}` },
    });
    if (response.status === 401) {
      current = await accessToken(admin, organizationId, true);
      continue;
    }
    if (!response.ok) throw new Error("logo_place_failed");
    const body = asRecord(await response.json()) ?? {};
    const id = logoAssetId(body);
    if (id) return id;
    const status = String(nestedRecord(body, "job")?.status ?? body.status ?? "").toLowerCase();
    if (status === "failed" || status === "failure" || status === "error") throw new Error("logo_place_failed");
  }
  throw new Error("logo_place_failed");
}

async function placeLogoInDesign(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  designId: string,
  logoPath: string,
): Promise<void> {
  const signed = await admin.storage.from(LOGO_BUCKET).createSignedUrl(logoPath, 300);
  const url = signed.data?.signedUrl ?? "";
  if (!url.startsWith("https://")) throw new Error("logo_missing");
  const uploaded = await callRaw(admin, organizationId, token, "upload-asset-from-url", {
    url,
    name: "company-logo.png",
    user_intent: "mengunggah logo perusahaan untuk ditaruh di tengah atas setiap slide",
  });
  token = uploaded.token;
  let assetId = logoAssetId(uploaded.payload);
  const job = asRecord(uploaded.payload.job);
  const jobId = String(job?.id ?? uploaded.payload.job_id ?? "").trim();
  const uploadStatus = String(job?.status ?? uploaded.payload.status ?? "").toLowerCase();
  if (!assetId && uploadStatus !== "failed" && jobId) {
    assetId = await pollLogoUpload(admin, organizationId, token, jobId);
  }
  if (!assetId) throw new Error("logo_place_failed");

  const opened = await openEditing(admin, organizationId, token, designId, "membuka desain untuk menempelkan logo perusahaan");
  token = opened.token;
  const session = opened.session;
  const logoPages = session.pages.filter((page) => !page.responsive);
  if (!session.transactionId || logoPages.length === 0) throw new Error("logo_place_failed");
  let inserted = 0;
  try {
    for (const page of logoPages) {
      const box = Math.max(72, Math.round(Math.min(page.width, page.height) * 0.16));
      const edited = await editPage(admin, organizationId, token, session, page.pageNumber, [{
        type: "insert_fill",
        page_id: page.id,
        asset_type: "image",
        asset_id: assetId,
        alt_text: "Logo perusahaan",
        top: Math.round(Math.min(page.width, page.height) * 0.03),
        left: Math.round((page.width - box) / 2),
        width: box,
        height: box,
      }], "menempelkan logo perusahaan di tengah atas slide");
      token = edited.token;
      if (!edited.ok) throw new Error("logo_place_failed");
      inserted += 1;
    }
    if (inserted === 0) throw new Error("logo_place_failed");
    const committed = await finishEditing(admin, organizationId, token, session, "commit", "menyimpan logo perusahaan di setiap slide");
    if (!committed.ok) throw new Error("logo_place_failed");
  } catch (error) {
    await finishEditing(admin, organizationId, token, session, "cancel", "membatalkan logo yang gagal dipasang").catch(() => undefined);
    throw error;
  }
}

/**
 * Canva's first export is the production deliverable: the table already shows Need Review
 * from the images, so record when it was finished. Only fills an empty date while the plan
 * is not under revision; production_status itself is left as it is.
 */
async function markProductionDone(admin: SupabaseClient, planId: string): Promise<void> {
  await admin
    .from("social_media_plans")
    .update({ production_completion_date: new Date().toISOString() })
    .eq("id", planId)
    .is("production_completion_date", null)
    .or("production_status.is.null,production_status.eq.Need Review");
}

type ProductPhoto = { name: string; path: string };

async function briefProductPhotos(
  admin: SupabaseClient,
  planId: string,
): Promise<ProductPhoto[]> {
  const { data: plan } = await admin
    .from("social_media_plans")
    .select("pic_id, organization_id, sub_service_id, sub_service_ids")
    .eq("id", planId)
    .maybeSingle();
  if (!plan?.organization_id) return [];
  // Menus the AI run picked for this plan: send only their real photos.
  const picked = (Array.isArray(plan.sub_service_ids) ? plan.sub_service_ids : [])
    .map((id: unknown) => String(id))
    .filter((id: string) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 3);
  if (picked.length > 0) return libraryPhotos(admin, String(plan.organization_id), picked);
  if (!plan.pic_id) return [];
  const { data: brief } = await admin
    .from("ai_employee_briefs")
    .select("sub_service_ids, sub_service_id")
    .eq("employee_id", plan.pic_id)
    .maybeSingle();
  const stored = Array.isArray(brief?.sub_service_ids)
    ? brief.sub_service_ids.map((id: unknown) => String(id))
    : [];
  const fallback = brief?.sub_service_id ? [String(brief.sub_service_id)] : [];
  const ids = stored.length > 0 ? stored : fallback;
  const planSub = plan.sub_service_id ? String(plan.sub_service_id) : "";
  const ordered = [...(planSub ? [planSub] : []), ...ids.filter((id) => id !== planSub)]
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, MAX_PRODUCT_PHOTOS);
  if (ordered.length === 0) return [];
  return libraryPhotos(admin, String(plan.organization_id), ordered);
}

async function libraryPhotos(
  admin: SupabaseClient,
  organizationId: string,
  ids: string[],
): Promise<ProductPhoto[]> {
  const { data, error } = await admin.rpc("sub_service_library_photos", {
    p_organization_id: organizationId,
    p_ids: ids,
  });
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((row) => {
    const record = asRecord(row);
    const path = String(record?.photo_path ?? "").trim();
    if (!path) return [];
    const name = String(record?.product_name ?? "Produk").replace(/\s+/g, " ").trim().slice(0, 80) || "Produk";
    return [{ name, path }];
  });
}

async function selectedLogo(
  admin: SupabaseClient,
  planId: string,
): Promise<{ path: string } | null> {
  const { data: plan } = await admin
    .from("social_media_plans")
    .select("pic_id, organization_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan?.pic_id) return null;
  const { data: brief } = await admin
    .from("ai_employee_briefs")
    .select("company_logo_id, service_ids, organization_id")
    .eq("employee_id", plan.pic_id)
    .maybeSingle();
  if (!brief?.company_logo_id) return null;
  const services = Array.isArray(brief.service_ids) ? brief.service_ids.map((id) => String(id)) : [];
  if (services.length !== 1) throw new Error("logo_missing");
  const { data: logo } = await admin
    .from("digital_asset_company_logos")
    .select("logo_path, service_id, organization_id")
    .eq("id", brief.company_logo_id)
    .maybeSingle();
  const path = String(logo?.logo_path ?? "").trim();
  if (!logo || logo.organization_id !== plan.organization_id || String(logo.service_id ?? "") !== services[0] || !path) {
    throw new Error("logo_missing");
  }
  return { path };
}

async function activeLogoBytes(
  admin: SupabaseClient,
  planId: string,
): Promise<Uint8Array | null> {
  const logo = await selectedLogo(admin, planId);
  if (!logo) return null;
  const { data, error } = await admin.storage.from(LOGO_BUCKET).download(logo.path);
  if (error || !data) throw new Error("logo_missing");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength < 32) throw new Error("logo_missing");
  return bytes;
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
      // Real menu photos are no longer pasted into the design: they did not fit the layout.
      // Canva draws the food itself from the menu names and the food photo rule.
      const logoChoice = await selectedLogo(admin, planId);
      const logo = logoChoice ? await activeLogoBytes(admin, planId) : null;
      let placedInDesign = false;
      if (logo && logoChoice) {
        try {
          await placeLogoInDesign(admin, organizationId, token, String(locked.design_id), logoChoice.path);
          placedInDesign = true;
        } catch (error) {
          console.log(JSON.stringify({
            event: "canva_logo_failed",
            plan_id: planId,
            error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
          }));
          if (publicError(error) === "logo_missing") throw error;
        }
      }
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
        const original = await downloadJpeg(url);
        const bytes = logo && !placedInDesign ? await stampLogoOnSlide(original, logo) : original;
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
      await markProductionDone(admin, planId);
      await admin
        .from("canva_carousel_runs")
        .update({
          images_ready: true,
          logo_placed: !logo || placedInDesign,
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
        await markProductionDone(admin, planId);
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

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function geminiModel(stored: string): string {
  const name = stored.trim();
  const model = name.startsWith("gemini-") ? name : "gemini-2.5-flash";
  const replaced: Record<string, string> = {
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-1.5-flash-latest": "gemini-2.5-flash",
    "gemini-1.5-pro": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.0-flash-exp": "gemini-2.5-flash",
  };
  return replaced[model] ?? model;
}

async function referenceStyleLock(
  admin: SupabaseClient,
  organizationId: string,
  employeeId: string,
  preferred: number | null,
): Promise<string> {
  if (!employeeId) return "";
  const { data } = await admin
    .from("ai_employee_brief_references")
    .select("position, storage_path")
    .eq("employee_id", employeeId)
    .eq("organization_id", organizationId)
    .order("position");
  const rows = (data ?? []).filter((row) => String(row.storage_path ?? "").trim());
  if (rows.length === 0) return "";
  const ordered = preferred
    ? [
      ...rows.filter((row) => Number(row.position) === preferred),
      ...rows.filter((row) => Number(row.position) !== preferred),
    ]
    : rows;
  const { data: config } = await admin
    .from("organization_script_ai_config")
    .select("google_ai_api_key, model")
    .eq("organization_id", organizationId)
    .maybeSingle();
  const apiKey = String(config?.google_ai_api_key ?? "").trim();
  if (!apiKey) return "";
  const model = geminiModel(String(config?.model ?? ""));
  const notes: string[] = [];
  // A carousel built on one slot only needs that slot described.
  const described = preferred && ordered[0] && Number(ordered[0].position) === preferred ? ordered.slice(0, 1) : ordered.slice(0, 5);
  for (const row of described) {
    const path = String(row.storage_path);
    const signed = await admin.storage.from(REFERENCE_BUCKET).createSignedUrl(path, 120);
    const url = signed.data?.signedUrl ?? "";
    if (!url.startsWith("https://")) continue;
    const image = await fetch(url);
    if (!image.ok) continue;
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (bytes.byteLength < 32 || bytes.byteLength > 5_000_000) continue;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: mimeFromPath(path),
                  data: bytesToBase64(bytes),
                },
              },
              {
                text: [
                  `This image is layout reference ${row.position} for one Instagram carousel page (portrait 4:5).`,
                  "Describe its layout so a designer who never sees it can rebuild it. Be as detailed as you need.",
                  "Answer in exactly these five labelled lines, each label once, in this order:",
                  "PHOTO: where the main photo or picture sits, what share of the page it fills in percent, its crop or shape, what it shows in general terms.",
                  "HEADLINE: position, alignment, size compared to the page width, number of lines, weight, case, any tilt or overlap with the photo.",
                  "TEXT: every smaller text block, label, price tag or call to action, with its position and size.",
                  "DECOR: frames, shapes, stickers, badges, dividers, shadows, textures, and where each sits.",
                  "TYPE: the typeface by name if you recognize it, otherwise its style, weight and case, for headline and body.",
                  "Use positions like top-left, center, bottom third, and sizes in percent of the page.",
                  "Do not mention any color, logo, brand name, or the words printed on the image.",
                ].join("\n"),
              },
            ],
          }],
          // gemini-2.5 spends output tokens on thinking first; turn it off so the reply is not cut.
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
        }),
      },
    );
    if (!response.ok) continue;
    const body = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = layoutOnlyDescription((body.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join(" "));
    console.log(JSON.stringify({
      event: "canva_layout_description",
      employee_id: employeeId,
      position: Number(row.position),
      chars: text.length,
      text: text.slice(0, 2000),
    }));
    if (text) notes.push(`Referensi ${row.position}: ${text}`);
  }
  return notes.join(" ");
}

async function completeDesign(
  admin: SupabaseClient,
  planId: string,
  organizationId: string,
  token: string,
  designId: string,
  designUrl: string,
): Promise<void> {
  await markSucceeded(admin, planId, designId, designUrl);
  await exportCarouselImages(admin, planId, organizationId);
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

function jobStillOpen(status: string, failureMessage: string): boolean {
  if (/polled_too_early|too early/i.test(status) || /polled_too_early|too early/i.test(failureMessage)) return true;
  return ["pending", "in_progress", "processing", "queued", "running"].includes(status);
}

function pollIsTransient(message: string): boolean {
  return /polled_too_early|too early|canva_mcp_http_429|canva_mcp_http_5\d\d|network|timed? ?out|fetch failed/i.test(message);
}

async function pollJob(
  admin: SupabaseClient,
  planId: string,
  organizationId: string,
  token: string,
  jobId: string,
  continuationToken: string,
  initialWait = 2,
): Promise<"succeeded" | "running"> {
  const deadline = Date.now() + POLL_BUDGET_MS;
  let currentToken = token;
  let nextContinuation = continuationToken;
  let waitSeconds = Math.min(Math.max(initialWait, 2), 20);
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    await sleep(Math.min(Math.max(waitSeconds, 2), 20, Math.floor(remaining / 1000)) * 1000);
    const called = await callTool(admin, organizationId, currentToken, "get-create-design-async-job", {
      job_id: jobId,
      user_intent: USER_INTENT,
      ...(nextContinuation ? { continuation_token: nextContinuation } : {}),
    });
    currentToken = called.token;
    const job = called.job;
    if (job.token) nextContinuation = job.token;
    if (job.status === "completed" || job.status === "success") {
      if (!job.designUrl.startsWith("https://")) throw new Error("design_missing");
      await completeDesign(admin, planId, organizationId, currentToken, job.designId, job.designUrl);
      return "succeeded";
    }
    if (!jobStillOpen(job.status, job.failureMessage)) {
      throw new Error(`canva_job_failed:${job.failureMessage || job.status || "canva_failed"}`);
    }
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
    .select("status, canva_job_id, continuation_token, attempts, updated_at, organization_id, images_ready, revision_requested, design_id, logo_placed, error, export_attempts")
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
    const logoStillMissing = run.logo_placed !== true
      && Boolean(run.design_id)
      && !String(run.error ?? "").startsWith("logo_");
    if (logoStillMissing && Number(run.export_attempts ?? 0) < 3) {
      const organizationId = String(run.organization_id);
      await admin.from("canva_carousel_runs").update({
        images_ready: false,
        refresh_requested: true,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq("social_media_plan_id", planId).eq("status", "succeeded");
      await exportCarouselImages(admin, planId, organizationId);
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
    const organizationId = String(plan.organization_id);
    const { data: employeeBrief } = await admin
      .from("ai_employee_briefs")
      .select("required_notes, forbidden_notes")
      .eq("employee_id", plan.pic_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const styleLock = await referenceStyleLock(
      admin,
      organizationId,
      String(plan.pic_id ?? ""),
      carouselReferencePosition(slides),
    ).catch(() => "");
    const logo = await selectedLogo(admin, planId);
    const productPhotos = await briefProductPhotos(admin, planId).catch(() => []);
    const brief = buildCanvaCarouselBrief({
      title: String(plan.title ?? ""),
      caption: String(captions?.[0]?.content ?? ""),
      slides,
      styleLock,
      palette: carouselPalette(String(plan.brief ?? "")),
      logo: logo ? "required" : "none",
      menus: productPhotos.map((photo) => photo.name),
      requiredNote: String(employeeBrief?.required_notes ?? ""),
      forbiddenNote: String(employeeBrief?.forbidden_notes ?? ""),
    });

    console.log(JSON.stringify({ event: "canva_brief", plan_id: planId, chars: brief.length, brief }));

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
      await completeDesign(admin, planId, organizationId, token, created.job.designId, created.job.designUrl);
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
      created.job.wait,
    );
    return json({ ok: true, status: outcome });
  } catch (error) {
    const message = publicError(error);
    if (message === "design_missing" || message === "logo_missing" || message === "logo_place_failed") {
      await markFailed(admin, planId, message);
      return json({ ok: false, status: "failed" });
    }
    const { data: current } = await admin
      .from("canva_carousel_runs")
      .select("canva_job_id, continuation_token, status")
      .eq("social_media_plan_id", planId)
      .maybeSingle();
    if (current?.canva_job_id && current.status !== "succeeded" && pollIsTransient(message)) {
      await saveJob(admin, planId, String(current.canva_job_id), String(current.continuation_token ?? ""));
      await admin
        .from("canva_carousel_runs")
        .update({ error: message, updated_at: new Date().toISOString() })
        .eq("social_media_plan_id", planId)
        .neq("status", "succeeded");
      return json({ ok: false, status: "running" });
    }
    await markFailed(admin, planId, message);
    return json({ ok: false, status: "failed" });
  }
});
