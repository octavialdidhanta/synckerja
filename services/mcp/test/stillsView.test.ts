import { describe, expect, it, vi } from "vitest";
import { getStillsResult, stillsSheetResult } from "../src/tools/render/stillsView";

const ctx = { userId: "u", organizationId: "org1" } as never;
const jobId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const job = (status: string, result: Record<string, unknown> | null = null) => ({
  jobs: [{ job_id: jobId, title: "Still", plan_id: null, status, stage: null, progress: 0, attempts: 1, error: null, result, created_at: "", finished_at: null }],
});

describe("still sheet as a picture", () => {
  it("waits until done and returns the uploaded sheet as an image", async () => {
    let calls = 0;
    const list = vi.fn(async () => (++calls < 3 ? job("running") : job("done", { stills_path: "org1/render-stills/x.jpg", stills: [1, 2] })));
    const res = (await stillsSheetResult(ctx, jobId, 60, {
      listRenderJobs: list,
      downloadRenderStill: async () => new Uint8Array([1, 2, 3]),
      sleep: async () => undefined,
    })) as { mcpContent: Array<{ type: string; mimeType?: string; text?: string }> };
    expect(list).toHaveBeenCalledTimes(3);
    expect(res.mcpContent[1]).toMatchObject({ type: "image", mimeType: "image/jpeg" });
    expect(JSON.parse(res.mcpContent[0]!.text!).stills).toEqual([1, 2]);
  });

  it("stops at the wait limit and says to call render.stills.get", async () => {
    let t = 0;
    const res = (await stillsSheetResult(ctx, jobId, 5, {
      listRenderJobs: async () => job("queued"),
      sleep: async () => void (t += 3000),
      now: () => t,
    })) as { status: string; next_step: string };
    expect(res.status).toBe("queued");
    expect(res.next_step).toMatch(/render\.stills\.get/);
  });

  it("an older Agent without upload falls back to the laptop file", async () => {
    const res = (await getStillsResult(ctx, { job_id: jobId, wait_seconds: 0 }, {
      listRenderJobs: async () => job("done", { stills_file: "P1/_build/still/a_still.jpg" }),
      downloadRenderStill: async () => new Uint8Array(),
    })) as { image: null; stills_file: string; reason: string };
    expect(res.image).toBeNull();
    expect(res.stills_file).toBe("P1/_build/still/a_still.jpg");
    expect(res.reason).toMatch(/0\.1\.20/);
  });
});

describe("default still seconds", () => {
  it("takes the middle of every text window and the closer", async () => {
    const { defaultStills } = await import("../src/tools/render/jobs");
    const spec = {
      version: 1,
      production: "P",
      output_name: "o",
      shots: [{ file_key: "a.mp4", in: 0, out: 10 }],
      audio: {},
      styles: {},
      texts: [
        { text: "Hook", start: 0, end: 2, style: "hook" },
        { text: "Sub", start: 3, end: 5, style: "sub" },
      ],
    } as never;
    expect(defaultStills(spec)).toEqual([1, 4, 9.8]);
  });
});
