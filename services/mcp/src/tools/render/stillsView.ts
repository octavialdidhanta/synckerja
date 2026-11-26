/**
 * Wait for a still preview and hand back its contact sheet as a picture, so Claude checks it in the same call
 * (no polling render.jobs.list, no laptop folder needed). The Agent uploads the sheet from 0.1.20.
 */
import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { RenderJobsList } from "../../db/render";
import type { McpContentBlock, McpContentResult } from "../footage/view";

export const STILLS_WAIT_DEFAULT = 75;

export const renderStillsGetInput = z
  .object({
    job_id: z.string().uuid(),
    /** How long to wait for the Agent (seconds, max 90). 0 only looks. */
    wait_seconds: z.number().int().min(0).max(90).optional(),
  })
  .strict();

export type StillsDeps = {
  listRenderJobs: (ctx: McpAuthContext, limit: number) => Promise<RenderJobsList>;
  downloadRenderStill?: (ctx: McpAuthContext, path: string) => Promise<Uint8Array>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

type Job = RenderJobsList["jobs"][number];

const FINISHED = new Set(["done", "failed", "cancelled"]);

async function waitForJob(ctx: McpAuthContext, jobId: string, seconds: number, deps: StillsDeps): Promise<Job | null> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const until = now() + seconds * 1000;
  for (;;) {
    const job = (await deps.listRenderJobs(ctx, 20)).jobs.find((j) => j.job_id === jobId) ?? null;
    if (!job || FINISHED.has(job.status) || now() >= until) return job;
    await sleep(3000);
  }
}

/** The sheet as an image block plus a short JSON header; a plain object when there is no picture to show. */
export async function stillsSheetResult(
  ctx: McpAuthContext,
  jobId: string,
  waitSeconds: number,
  deps: StillsDeps,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown> | McpContentResult> {
  const job = await waitForJob(ctx, jobId, waitSeconds, deps);
  if (!job) throw new Error("not_found");
  const result = job.result ?? {};
  const base = { ...extra, job_id: jobId, status: job.status, stage: job.stage, progress: job.progress };
  if (job.status !== "done") {
    return {
      ...base,
      error: job.error,
      next_step: FINISHED.has(job.status)
        ? "The still preview did not finish: read error, fix the spec and call render.stills.create again."
        : "Still rendering on the laptop (is the Agent online?). Call render.stills.get with this job_id to wait again.",
    };
  }
  const stillsPath = typeof result.stills_path === "string" ? result.stills_path : null;
  const header = {
    ...base,
    stills: result.stills ?? null,
    stills_file: result.stills_file ?? null,
    note:
      "Contact sheet of the asked seconds, in order, each labelled with its second. Check every text: inside the frame, not cut off, not covering the food, the face or the logo, readable. " +
      "Fix with a patch on the same draft_id and make a new still; when clean, render.jobs.create.preview for the full video (gate 3).",
  };
  if (!stillsPath || !deps.downloadRenderStill) {
    return {
      ...header,
      image: null,
      reason: stillsPath ? "not_available_here" : "not_uploaded (Agent older than 0.1.20, or the upload failed): open stills_file in the production folder",
    };
  }
  let bytes: Uint8Array;
  try {
    bytes = await deps.downloadRenderStill(ctx, stillsPath);
  } catch {
    return { ...header, image: null, reason: "not_found in storage: open stills_file in the production folder" };
  }
  const content: McpContentBlock[] = [
    { type: "text", text: JSON.stringify(header) },
    { type: "image", data: Buffer.from(bytes).toString("base64"), mimeType: "image/jpeg" },
  ];
  return { mcpContent: content };
}

export async function getStillsResult(ctx: McpAuthContext, args: unknown, deps: StillsDeps) {
  const parsed = renderStillsGetInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return stillsSheetResult(ctx, parsed.data.job_id, parsed.data.wait_seconds ?? STILLS_WAIT_DEFAULT, deps);
}
