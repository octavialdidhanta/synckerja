import { describe, expect, it, vi } from "vitest";
import { getRenderJobResult, renderJobsGetInput } from "../src/tools/render/jobGet";
import { MCP_TOOLS } from "../src/mcp/registry";

const ctx = { userId: "u", organizationId: "o" } as never;
const planId = "6d1ff665-7412-4bd2-b563-5f2a50e4f460";
const jobId = "dd8d1411-5af8-40ef-b757-f7486d3f76c9";

const spec = {
  version: 1,
  production: "6d1ff665 Sumsumnya Masih Nyangkut",
  output_name: "6d1ff665_Sumsumnya_Masih_Nyangkut_VO_v4_9x16",
  shots: [
    { file_key: "PIK1/sop sumsum/a.mp4", in: 1, out: 3.5 },
    { file_key: "PIK1/sop sumsum/Man_eating_goat_marrow_soup_da1ed666.mp4", in: 4.4, out: 6.7 },
  ],
  audio: {},
  styles: { judul: { size: 11 } },
  texts: [{ text: "Langkah 1", start: 1, end: 2, style: "judul" }],
};
const job = {
  job_id: jobId,
  title: "Sumsumnya Masih Nyangkut v4",
  plan_id: planId,
  status: "done",
  stage: "selesai",
  error: null,
  result: { version_no: 1 },
  spec,
  created_at: "2026-11-26T04:43:17Z",
  finished_at: "2026-11-26T04:44:54Z",
};

describe("render.jobs.get", () => {
  it("takes job_id or plan_id, not both and not neither", () => {
    expect(renderJobsGetInput.safeParse({ job_id: jobId }).success).toBe(true);
    expect(renderJobsGetInput.safeParse({ plan_id: planId, as_draft: false }).success).toBe(true);
    expect(renderJobsGetInput.safeParse({}).success).toBe(false);
    expect(renderJobsGetInput.safeParse({ job_id: jobId, plan_id: planId }).success).toBe(false);
  });

  it("returns the rendered spec and saves it as a draft with the job's plan_id", async () => {
    const get = vi.fn(async () => job);
    const save = vi.fn(async () => ({ draft_id: "11111111-1111-4111-8111-111111111111", expires_at: "2026-12-03T00:00:00Z" }));
    const r = await getRenderJobResult(ctx, { plan_id: planId }, get, save);
    expect(get).toHaveBeenCalledWith(ctx, { job_id: null, plan_id: planId });
    expect(save).toHaveBeenCalledWith(ctx, expect.objectContaining({ title: "Sumsumnya Masih Nyangkut v4", plan_id: planId }));
    expect(r.draft_id).toBe("11111111-1111-4111-8111-111111111111");
    expect((r.spec as typeof spec).shots[1]).toEqual({ file_key: "PIK1/sop sumsum/Man_eating_goat_marrow_soup_da1ed666.mp4", in: 4.4, out: 6.7 });
    expect(r.summary).toMatchObject({ shots: 2, texts: 1, still_preview: false, output_name: spec.output_name });
  });

  it("as_draft false only reads; a still job keeps its plan-less title without the Still prefix", async () => {
    const save = vi.fn();
    const r = await getRenderJobResult(ctx, { job_id: jobId, as_draft: false }, async () => job, save);
    expect(save).not.toHaveBeenCalled();
    expect(r.draft_id).toBeUndefined();

    const save2 = vi.fn(async () => ({ draft_id: "22222222-2222-4222-8222-222222222222", expires_at: "x" }));
    await getRenderJobResult(
      ctx,
      { job_id: jobId },
      async () => ({ ...job, title: "Still – Sumsumnya v5", plan_id: null, spec: { ...spec, stills: [1, 2] } }),
      save2,
    );
    expect(save2).toHaveBeenCalledWith(ctx, expect.objectContaining({ title: "Sumsumnya v5", plan_id: null }));
  });

  it("an old spec that no longer passes the schema is returned but not made into a draft", async () => {
    const save = vi.fn();
    const r = await getRenderJobResult(ctx, { job_id: jobId }, async () => ({ ...job, spec: { version: 1, shots: [] } }), save);
    expect(save).not.toHaveBeenCalled();
    expect(r.summary).toBeNull();
    expect((r.warnings as string[])[0]).toMatch(/tidak dijadikan draft/);
  });

  it("is a read tool in the registry", () => {
    const tool = MCP_TOOLS.find((t) => t.name === "render.jobs.get");
    expect(tool?.scopes).toEqual(["content:read"]);
  });
});
