import { describe, expect, it } from "vitest";
import type { McpAuthContext } from "../src/authz/context";
import { createStillsResult } from "../src/tools/render/jobs";

const ctx = {} as McpAuthContext;
const spec = {
  version: 1,
  production: "769b1513 4 Green Flag Sop Sumsum",
  output_name: "769b1513_Green_Flag_VO_v4_9x16",
  shots: [{ file_key: "PIK1/a.mp4", in: 0, out: 2 }],
};

describe("render.stills.create", () => {
  it("queues a still job at once, without a plan, with the asked seconds", async () => {
    const seen: { plan_id: string | null; title: string; spec: unknown }[] = [];
    const out = await createStillsResult(
      ctx,
      { title: "Green Flag v4", spec, stills: [1, 7.5] },
      async (_c, input) => {
        seen.push(input);
        return { preview_id: "p1" } as never;
      },
      async (_c, id) => ({ saved: true, job_id: `job-${id}`, status: "queued" }) as never,
    );
    expect(out).toMatchObject({ saved: true, job_id: "job-p1", stills: [1, 7.5] });
    expect(seen[0]!.plan_id).toBeNull();
    expect(seen[0]!.title).toBe("Still – Green Flag v4");
    expect((seen[0]!.spec as { stills: number[] }).stills).toEqual([1, 7.5]);
  });

  it("picks default seconds when none are given, and does not queue on a technical error", async () => {
    const never = async () => {
      throw new Error("must not be called");
    };
    const noStills = await createStillsResult(ctx, { title: "x", spec }, never, never, undefined, async () => null);
    expect((noStills as { checks: unknown }).checks).toBeDefined();
    const out = await createStillsResult(ctx, { title: "x", spec, stills: [1] }, never, never, undefined, async () => null);
    expect(out).toMatchObject({ error: "spec_check_failed" });
  });
});
