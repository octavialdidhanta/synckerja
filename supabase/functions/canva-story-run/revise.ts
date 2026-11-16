/**
 * Story revision: recreate via create-design (same path as first render).
 * Magic Design frames rarely expose editable headline text, so carousel-style
 * edit-design + "Do not add written text" image fills cannot apply review comments.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCanvaStoryBrief,
  parseStoryBriefFields,
  storyBriefReady,
  STORY_BRIEF_LIMIT_FULL,
  STORY_BRIEF_LIMIT_SHORT,
} from "../_shared/canvaStoryBrief.ts";
import { callCanvaTool, listCanvaMcpTools } from "../_shared/canvaMcp.ts";
import { readCanvaToolJson } from "../_shared/canvaMcpParse.ts";
import { getCanvaAccessToken } from "../_shared/canvaToken.ts";

const STORY_FORMAT = "Instagram Story";
const USER_INTENT = "instagram story 9:16 satu frame — revisi sesuai komentar review";
const POLL_BUDGET_MS = 100_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function publicError(value: unknown): string {
  const text = String(value instanceof Error ? value.message : value ?? "revision_failed")
    .replace(/sbp_[A-Za-z0-9]+/g, "")
    .replace(/eyJ[A-Za-z0-9_-]{8,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 160) || "revision_failed";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractUbahKeTarget(comment: string): string {
  // Last "Ubah ke" wins when several review comments are open (newest instruction).
  const matches = [...comment.matchAll(/ubah\s+ke\s*[：:]?\s*[“"']([^”"']{3,})[”"']/gi)];
  const last = matches[matches.length - 1];
  return last?.[1]?.trim() ?? "";
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

function jobStillOpen(status: string, failureMessage: string): boolean {
  if (/polled_too_early|too early/i.test(status) || /polled_too_early|too early/i.test(failureMessage)) {
    return true;
  }
  return ["pending", "in_progress", "processing", "queued", "running"].includes(status);
}

async function callTool(
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
    const refreshed = await getCanvaAccessToken(admin, organizationId, { forceRefresh: true });
    const raw = await callCanvaTool(refreshed, name, args);
    return { token: refreshed, payload: readCanvaToolJson(raw) };
  }
}

async function createAndWait(
  admin: SupabaseClient,
  organizationId: string,
  token: string,
  brief: string,
): Promise<{ token: string; designId: string; designUrl: string }> {
  let created = await callTool(admin, organizationId, token, "create-design", {
    brief,
    format: STORY_FORMAT,
    user_intent: USER_INTENT,
  });
  token = created.token;
  let job = readJob(created.payload);
  if ((job.status === "failed" || !job.jobId) && /format|story|design type/i.test(job.failureMessage)) {
    created = await callTool(admin, organizationId, token, "create-design", {
      brief,
      user_intent: USER_INTENT,
    });
    token = created.token;
    job = readJob(created.payload);
  }
  if (job.status === "completed" || job.status === "success") {
    if (!job.designId || !job.designUrl.startsWith("https://")) throw new Error("revision_design_missing");
    return { token, designId: job.designId, designUrl: job.designUrl };
  }
  if (job.status === "failed" || !job.jobId) throw new Error(job.failureMessage || "revision_create_failed");

  const deadline = Date.now() + POLL_BUDGET_MS;
  let continuation = job.token;
  let jobId = job.jobId;
  while (Date.now() < deadline) {
    await sleep(Math.min(Math.max(job.wait, 5), 20) * 1000);
    const polled = await callTool(admin, organizationId, token, "get-create-design-async-job", {
      job_id: jobId,
      ...(continuation ? { continuation_token: continuation } : {}),
      user_intent: "menunggu revisi story Canva",
    });
    token = polled.token;
    job = readJob(polled.payload);
    if (job.jobId) jobId = job.jobId;
    if (job.token) continuation = job.token;
    if (job.status === "completed" || job.status === "success") {
      if (!job.designId || !job.designUrl.startsWith("https://")) throw new Error("revision_design_missing");
      return { token, designId: job.designId, designUrl: job.designUrl };
    }
    if (!jobStillOpen(job.status, job.failureMessage) && job.status === "failed") {
      throw new Error(job.failureMessage || "revision_create_failed");
    }
  }
  throw new Error("revision_create_timeout");
}

export async function reviseStory(
  admin: SupabaseClient,
  planId: string,
  organizationId: string,
  exportImages: () => Promise<void>,
): Promise<void> {
  const { data: run } = await admin
    .from("canva_story_runs")
    .select("status, design_id, updated_at, revision_requested, revision_attempts")
    .eq("social_media_plan_id", planId)
    .maybeSingle();
  if (!run || run.status !== "succeeded" || run.revision_requested !== true || !run.design_id) return;
  if (Number(run.revision_attempts) >= 3) {
    await admin.from("canva_story_runs").update({
      revision_requested: false,
      error: "revision_failed",
      updated_at: new Date().toISOString(),
    }).eq("social_media_plan_id", planId).eq("status", "succeeded");
    return;
  }

  const now = new Date().toISOString();
  const { data: locked } = await admin
    .from("canva_story_runs")
    .update({
      updated_at: now,
      revision_attempts: Number(run.revision_attempts ?? 0) + 1,
      error: null,
    })
    .eq("social_media_plan_id", planId)
    .eq("updated_at", run.updated_at)
    .eq("revision_requested", true)
    .select("revision_attempts, design_id")
    .maybeSingle();
  if (!locked?.design_id) return;

  try {
    const { data: commentRows } = await admin
      .from("link_comments")
      .select("id, comment_text")
      .eq("social_media_plan_id", planId)
      .is("canva_revision_applied_at", null)
      .order("created_at", { ascending: true });
    const comments = (commentRows ?? []).filter((row) => String(row.comment_text ?? "").trim());
    if (comments.length === 0) throw new Error("story_comments_missing");

    const commentText = comments.map((row) => String(row.comment_text).trim()).join("\n\n");
    const appliedIds = comments.map((row) => String(row.id));
    const ubahKe = extractUbahKeTarget(commentText);

    const { data: plan } = await admin
      .from("social_media_plans")
      .select("title, brief")
      .eq("id", planId)
      .maybeSingle();
    if (!plan) throw new Error("revision_plan_missing");

    const fields = parseStoryBriefFields(String(plan.brief ?? ""));
    if (!storyBriefReady(fields)) throw new Error("story_brief_missing");
    if (ubahKe) fields.headline = ubahKe.slice(0, 160);

    const { data: captions } = await admin
      .from("brief_captions")
      .select("content")
      .eq("social_media_plan_id", planId)
      .limit(1);
    const captionText = String(captions?.[0]?.content ?? "");

    const requiredNote = [
      "Apply every production review note below to this single Story frame.",
      ubahKe ? `On-screen headline must read exactly: ${ubahKe}` : "",
      commentText.slice(0, 1100),
    ].filter(Boolean).join("\n");

    let brief = buildCanvaStoryBrief({
      title: String(plan.title ?? ""),
      fields,
      caption: captionText,
      requiredNote,
    }, { limit: STORY_BRIEF_LIMIT_FULL });
    const shortBrief = buildCanvaStoryBrief({
      title: String(plan.title ?? ""),
      fields,
      caption: captionText,
      requiredNote: [
        ubahKe ? `On-screen headline must read exactly: ${ubahKe}` : "Apply review notes.",
        commentText.slice(0, 350),
      ].filter(Boolean).join("\n"),
    }, { limit: STORY_BRIEF_LIMIT_SHORT });

    let token = await getCanvaAccessToken(admin, organizationId);
    try {
      await listCanvaMcpTools(token);
    } catch (error) {
      if (publicError(error) !== "canva_unauthorized") throw error;
      token = await getCanvaAccessToken(admin, organizationId, { forceRefresh: true });
      await listCanvaMcpTools(token);
    }

    let design: { token: string; designId: string; designUrl: string };
    try {
      design = await createAndWait(admin, organizationId, token, brief);
    } catch (error) {
      const message = publicError(error);
      if (brief.length > shortBrief.length && !/timeout/i.test(message)) {
        design = await createAndWait(admin, organizationId, token, shortBrief);
      } else {
        throw error;
      }
    }

    const savedAt = new Date().toISOString();
    await admin.from("canva_story_runs").update({
      design_id: design.designId,
      design_url: design.designUrl,
      revision_requested: false,
      review_after_export: true,
      refresh_requested: true,
      images_ready: false,
      export_attempts: 0,
      canva_job_id: null,
      continuation_token: null,
      error: null,
      updated_at: savedAt,
    }).eq("social_media_plan_id", planId).eq("status", "succeeded");

    if (ubahKe) {
      const nextBrief = String(plan.brief ?? "").replace(
        /^Headline:\s*.+$/im,
        `Headline: ${ubahKe.slice(0, 160)}`,
      );
      if (nextBrief !== String(plan.brief ?? "")) {
        await admin.from("social_media_plans").update({ brief: nextBrief }).eq("id", planId);
      }
    }

    await admin.from("link_comments").update({
      canva_revision_applied_at: savedAt,
    }).in("id", appliedIds);

    await exportImages();
  } catch (error) {
    const message = publicError(error);
    const attempts = Number(locked.revision_attempts ?? 1);
    const stillTrying = attempts < 3
      && message !== "story_comments_missing"
      && message !== "story_brief_missing"
      && message !== "revision_plan_missing";
    await admin.from("canva_story_runs").update({
      revision_requested: stillTrying,
      error: stillTrying ? null : message,
      updated_at: new Date().toISOString(),
    }).eq("social_media_plan_id", planId).eq("status", "succeeded");
  }
}
