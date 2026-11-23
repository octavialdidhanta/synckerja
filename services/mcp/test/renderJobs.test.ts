import { describe, expect, it } from "vitest";
import { applyRenderJob, previewRenderJob } from "../src/db/render";
import { MCP_TOOLS } from "../src/mcp/registry";
import { signFootageConfirmation, verifyFootageConfirmation } from "../src/tools/footage/confirmation";
import { applyRenderJobResult, previewRenderJobResult, renderJobCreatePreviewInput } from "../src/tools/render/jobs";
import { renderSpecV1, specDuration } from "../src/tools/render/renderSpec";

const ctx = { userId: "user-1", organizationId: "org-1" } as never;
const secret = "test-secret-at-least-16";
const previewId = "6b461c9c-dc68-4189-9383-fd548997e9b5";

const spec = {
  version: 1,
  production: "bd995747 Hari 6 Coba",
  output_name: "bd995747_Hari6_v1_9x16",
  shots: [
    { file_key: "PIK1/sate babi/Basting_satay_7910de9b.mp4", in: 1.2, out: 3.4, label: "hook" },
    { file_key: "INBOX/C0002.MP4", in: 0, out: 1.5 },
  ],
  audio: { vo: { file: "vo/VO_full.mp3" }, music: { file: "_build/musik.mp3", db: -18, fade_out: 1 } },
  styles: { sub: { size: 9, color: "#FFFFFF", stroke: "#000000", stroke_width: 0.14, bold: true, y: -0.54 } },
  texts: [{ text: "Weekend rame!", start: 0.2, end: 2, style: "sub", anim: "pop" }],
};

function fakeAdmin(data: unknown) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return { admin: { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push({ fn, args }), { data, error: null }) } as never, calls };
}

describe("render job spec v1", () => {
  it("accepts a normal edit and sums frame-exact shot lengths", () => {
    const parsed = renderSpecV1.parse(spec);
    expect(specDuration(parsed)).toBeCloseTo(2.2 + 1.5, 5);
  });

  it("refuses paths that leave the production folder, unknown keys, unknown styles and empty shots", () => {
    const bad = (patch: Record<string, unknown>) => renderSpecV1.safeParse({ ...spec, ...patch }).success;
    expect(bad({ audio: { vo: { file: "../rahasia.mp3" } } })).toBe(false);
    expect(bad({ audio: { vo: { file: "D:/x.mp3" } } })).toBe(false);
    expect(bad({ production: "a/b" })).toBe(false);
    expect(bad({ output_name: "../x" })).toBe(false);
    expect(bad({ effects: ["halftone"] })).toBe(false);
    expect(bad({ texts: [{ text: "x", start: 0, end: 1, style: "nope" }] })).toBe(false);
    expect(bad({ shots: [] })).toBe(false);
    expect(bad({ shots: [{ file_key: "a.mp4", in: 2, out: 2 }] })).toBe(false);
    expect(bad({})).toBe(true);
  });
});

describe("render.jobs.create", () => {
  it("previews with a summary and confirm token, then queues on confirm", async () => {
    const { admin, calls } = fakeAdmin({ plan: { plan_id: "p1", title: "Hari 6", production_status: "" }, preview_id: previewId, expires_at: new Date(Date.now() + 60_000).toISOString() });
    const out = await previewRenderJobResult(
      ctx,
      { plan_id: "8c5e1b2e-5d7a-4a43-9c55-6a0f8e7a1b20", title: "Hari 6 render", spec },
      (c, input) => previewRenderJob(admin, c as never, input),
      (c, tool, id, exp) => signFootageConfirmation(secret, c as never, tool, id, exp),
    );
    expect(calls[0]?.fn).toBe("mcp_preview_render_job");
    expect(out.summary).toMatchObject({ shots: 2, texts: 1, vo: "vo/VO_full.mp3", uploads_to_plan: true });
    const saver = fakeAdmin({ saved: true, job_id: "j1", status: "queued" });
    const saved = await applyRenderJobResult(
      ctx,
      { confirm_token: out.confirm_token },
      (c, tool, token) => verifyFootageConfirmation(secret, c as never, tool, token),
      (c, id) => applyRenderJob(saver.admin, c as never, id),
    );
    expect(saved.job_id).toBe("j1");
    expect(saver.calls[0]?.args.p_preview_id).toBe(previewId);
  });

  it("explains which field is wrong", async () => {
    await expect(
      previewRenderJobResult(ctx, { title: "x", spec: { ...spec, shots: [] } }, async () => { throw new Error("unused"); }, async () => { throw new Error("unused"); }),
    ).rejects.toThrow(/invalid_input: spec\.shots/);
  });

  it("is registered as a write that needs confirmation, and the list is read only", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["render.jobs.create.preview", "render.jobs.create", "render.jobs.list"]));
    expect(renderJobCreatePreviewInput.safeParse({ title: "x", spec, organization_id: "o2" }).success).toBe(false);
  });
});
