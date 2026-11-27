import { describe, expect, it } from "vitest";
import { getRenderPlanStatus, previewRenderJob, type RenderPlanStatus } from "../src/db/render";
import { signFootageConfirmation } from "../src/tools/footage/confirmation";
import { draftRenderJobResult } from "../src/tools/render/draft";
import { createStillsResult, previewRenderJobResult, voSummary } from "../src/tools/render/jobs";
import { planUploadFields, UPLOAD_BLOCK_MESSAGES } from "../src/tools/render/planStatus";
import { checkSpec } from "../src/tools/render/specChecks";
import { renderSpecV1 } from "../src/tools/render/renderSpec";

const ctx = { userId: "user-1", organizationId: "org-1" } as never;
const planId = "79316cbe-2cce-4fdd-8a10-84e3ebc72521";
const secret = "test-secret-at-least-16";
const previewId = "6b461c9c-dc68-4189-9383-fd548997e9b5";
const spec = {
  version: 1,
  production: "79316cbe Sop Sumsum Mitos",
  output_name: "79316cbe_SopSumsum_Mitos_VO_v1_9x16",
  shots: [{ file_key: "PIK1/a.mp4", in: 0, out: 2 }],
  audio: {
    vo_parts: [
      { file: "vo/vo-1.mp3", at: 0.05 },
      { file: "vo/vo-2.mp3", at: 1.2 },
    ],
    music: { file: "@musik/capcut/Food.mp3", db: -18 },
  },
};

const status = (upload_block: RenderPlanStatus["upload_block"], approved = upload_block !== "not_approved"): RenderPlanStatus => ({
  plan_id: planId,
  title: "Sop Sumsum Mitos",
  approved,
  upload_block,
});

describe("plan upload status", () => {
  it("says the render uploads only when nothing blocks it, with the reason otherwise", () => {
    expect(planUploadFields(status(null))).toEqual({ uploads_to_plan: true, upload_block: null });
    expect(planUploadFields(null)).toEqual({ uploads_to_plan: false, upload_block: null });
    for (const block of ["not_approved", "production_locked", "not_video_content", "not_connected"] as const) {
      const f = planUploadFields(status(block));
      expect(f.uploads_to_plan).toBe(false);
      expect(f.upload_block).toBe(block);
      expect(f.upload_warning).toBe(UPLOAD_BLOCK_MESSAGES[block]);
    }
    // An older database (before the migration) returns no upload_block: same as before, no warning.
    expect(planUploadFields({ plan_id: planId, title: null } as never)).toEqual({ uploads_to_plan: true, upload_block: null });
  });

  it("reads the status through mcp_render_plan_status with the session", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const admin = { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), { data: status("not_approved"), error: null }) } as never;
    const got = await getRenderPlanStatus(admin, ctx, planId);
    expect(got?.upload_block).toBe("not_approved");
    expect(calls[0]).toEqual({ fn: "mcp_render_plan_status", args: { p_user_id: "user-1", p_organization_id: "org-1", p_plan_id: planId } });
  });
});

describe("render.jobs.draft", () => {
  const draft = (lookup?: (c: unknown, id: string) => Promise<RenderPlanStatus | null>, withPlan = true) =>
    draftRenderJobResult(
      ctx,
      {
        title: "Sop Sumsum Mitos v1",
        production: spec.production,
        output_name: spec.output_name,
        shots: spec.shots,
        ...(withPlan ? { plan_id: planId } : {}),
      },
      async () => ({}),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      lookup as never,
    );

  it("warns first, before any still, when the brief is not approved", async () => {
    const out = (await draft(async () => status("not_approved"))) as Record<string, any>;
    expect(out.warnings[0]).toBe(UPLOAD_BLOCK_MESSAGES.not_approved);
    expect(out.upload_warning).toBe(UPLOAD_BLOCK_MESSAGES.not_approved);
    expect(out.summary).toMatchObject({ uploads_to_plan: false, upload_block: "not_approved" });
    expect(out.next_step).toMatch(/^Tell the user upload_warning now/);
  });

  it("stays quiet for an approved plan and for a draft without plan", async () => {
    const ok = (await draft(async () => status(null))) as Record<string, any>;
    expect(ok.upload_warning).toBeUndefined();
    expect(ok.summary).toMatchObject({ uploads_to_plan: true, upload_block: null });
    expect(ok.warnings.join(" ")).not.toMatch(/approve/);
    let asked = false;
    const none = (await draft(async () => ((asked = true), status(null)), false)) as Record<string, any>;
    expect(asked).toBe(false);
    expect(none.summary.uploads_to_plan).toBeUndefined();
  });

  it("does not break the draft when the status cannot be read, and says so", async () => {
    const out = (await draft(async () => {
      throw new Error("boom");
    })) as Record<string, any>;
    expect(out.draft_id ?? out.spec).toBeDefined();
    expect(out.warnings.join(" ")).toMatch(/Status plan tidak bisa dibaca \(boom\)/);
    expect(out.summary.uploads_to_plan).toBeUndefined();
  });
});

describe("render.jobs.create.preview", () => {
  const preview = (plan: unknown, extra: Record<string, unknown> = {}) => {
    const admin = { rpc: async () => ({ data: { plan, preview_id: previewId, expires_at: new Date(Date.now() + 60_000).toISOString() }, error: null }) } as never;
    return previewRenderJobResult(
      ctx,
      { plan_id: planId, title: "Sop Sumsum Mitos v1", spec: { ...spec, ...extra } },
      (c, input) => previewRenderJob(admin, c as never, input),
      (c, tool, id, exp) => signFootageConfirmation(secret, c as never, tool, id, exp),
    ) as Promise<Record<string, any>>;
  };

  it("shows that the video stays on the laptop when the brief is not approved", async () => {
    const out = await preview({ ...status("not_approved"), production_status: null });
    expect(out.summary).toMatchObject({ uploads_to_plan: false, upload_block: "not_approved", vo: "2 klip (vo_parts)" });
    expect(out.upload_warning).toBe(UPLOAD_BLOCK_MESSAGES.not_approved);
    expect(out.confirm_token).toBeTruthy();
    expect(out.next_step).toMatch(/^Show upload_warning/);
  });

  it("uploads for an approved plan, never for a still, and not without a plan", async () => {
    const ok = await preview({ ...status(null), production_status: null });
    expect(ok.summary).toMatchObject({ uploads_to_plan: true });
    expect(ok.upload_warning).toBeUndefined();
    const still = await preview({ ...status("not_approved"), production_status: null }, { stills: [1] });
    expect(still.summary.uploads_to_plan).toBe(false);
    expect(still.upload_warning).toBeUndefined();
    const noPlan = await preview(null);
    expect(noPlan.summary.uploads_to_plan).toBe(false);
  });
});

describe("render.stills.create", () => {
  it("queues the still without plan; a spec without plan asks no status", async () => {
    const seen: Array<string | null> = [];
    let asked = false;
    const out = (await createStillsResult(
      ctx,
      { title: "Sop Sumsum Mitos v1", spec, stills: [1], wait: false },
      async (_c, input) => (seen.push(input.plan_id), { preview_id: "p1" }) as never,
      async () => ({ saved: true, job_id: "j1", status: "queued" }) as never,
      undefined,
      undefined,
      undefined,
      undefined,
      async () => ((asked = true), status("not_approved")),
    )) as Record<string, any>;
    expect(seen).toEqual([null]);
    expect(asked).toBe(false);
    expect(out.upload_warning).toBeUndefined();
  });

  it("uses the draft's plan for the status", async () => {
    let asked: string | null = null;
    const out = (await createStillsResult(
      ctx,
      { draft_id: "8c5e1b2e-5d7a-4a43-9c55-6a0f8e7a1b20", stills: [1], wait: false },
      async () => ({ preview_id: "p1" }) as never,
      async () => ({ saved: true, job_id: "j1", status: "queued" }) as never,
      undefined,
      undefined,
      { get: async () => ({ draft_id: "d1", title: "Sop Sumsum Mitos v1", plan_id: planId, spec, expires_at: "" }) as never, update: async () => ({}) as never },
      undefined,
      async (_c, id) => ((asked = id), status("not_approved")),
    )) as Record<string, any>;
    expect(asked).toBe(planId);
    expect(out).toMatchObject({ upload_block: "not_approved", upload_warning: UPLOAD_BLOCK_MESSAGES.not_approved });
  });
});

describe("voice over with vo_parts", () => {
  it("is a voice over for the summary and for the no-VO style check", () => {
    const parsed = renderSpecV1.parse(spec);
    expect(voSummary(parsed)).toBe("2 klip (vo_parts)");
    expect(voSummary(renderSpecV1.parse({ ...spec, audio: { vo: { file: "vo/VO_full.mp3" } } }))).toBe("vo/VO_full.mp3");
    expect(voSummary(renderSpecV1.parse({ ...spec, audio: {} }))).toBeNull();
    const gaya = { musik: "Konten ASMR / tanpa VO: pakai suara asli" } as never;
    const codes = (s: unknown) => checkSpec(renderSpecV1.parse(s), gaya, [], []).suggestions.map((f) => f.code);
    expect(codes(spec)).not.toContain("no_vo_original_sound");
    expect(codes({ ...spec, audio: { music: { file: "@musik/capcut/Food.mp3" } } })).toContain("no_vo_original_sound");
  });
});
