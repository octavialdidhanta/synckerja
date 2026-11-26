import { describe, expect, it, vi } from "vitest";
import { applyDraftPatch, createStillsResult, previewRenderJobResult } from "../src/tools/render/jobs";

const ctx = { userId: "u", organizationId: "o" } as never;
const draftId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const spec = {
  version: 1,
  production: "P1 Coba",
  output_name: "P1_Coba_VO_v1_9x16",
  shots: [{ file_key: "INBOX/a.mp4", in: 1, out: 4 }],
  audio: {},
  styles: { sub: { size: 9, color: "#FFFFFF", y: -0.6 } },
  texts: [{ text: "Halo", start: 0.2, end: 1.5, style: "sub" }],
};

describe("render drafts (draft_id + patch)", () => {
  it("merges styles per name, replaces other keys, null removes", () => {
    const out = applyDraftPatch({ ...spec, stills: [1] }, { styles: { sub: { size: 10 } }, texts: [], stills: null });
    expect(out.styles).toEqual({ sub: { size: 10, color: "#FFFFFF", y: -0.6 } });
    expect(out.texts).toEqual([]);
    expect("stills" in out).toBe(false);
  });

  it("still preview from draft_id + patch saves the patched spec as a new draft", async () => {
    const get = vi.fn(async () => ({ draft_id: draftId, title: "Coba", plan_id: null, spec, expires_at: "x" }));
    const save = vi.fn(async () => ({ draft_id: "new-draft", expires_at: "x" }));
    const preview = vi.fn(async (_c, input: { title: string; spec: { stills: number[]; styles: { sub: { size: number } } } }) => {
      expect(input.title).toBe("Still – Coba");
      expect(input.spec.styles.sub.size).toBe(11);
      expect(input.spec.stills).toEqual([1]);
      return { plan: null, preview_id: "p", expires_at: "x" };
    });
    const apply = vi.fn(async () => ({ saved: true, job_id: "j", status: "queued" }));
    const res = await createStillsResult(
      ctx,
      { draft_id: draftId, patch: { styles: { sub: { size: 11 } } }, stills: [1] },
      preview,
      apply,
      undefined,
      undefined,
      { get, save },
    );
    expect(res.draft_id).toBe("new-draft");
    expect(save).toHaveBeenCalledOnce();
  });

  it("refuses spec and draft_id together, and a patch without draft_id", async () => {
    const sign = vi.fn();
    await expect(previewRenderJobResult(ctx, { title: "x", spec, draft_id: draftId }, vi.fn(), sign)).rejects.toThrow(/invalid_input/);
    await expect(previewRenderJobResult(ctx, { title: "x", spec, patch: {} }, vi.fn(), sign)).rejects.toThrow(/invalid_input/);
  });
});
