import { describe, expect, it, vi } from "vitest";
import { downloadFootageStrip, type FootageClip, type FootageScene } from "../src/db/footage";
import { stripFootageScenesInput, stripFootageScenesResult, stripFrameSeconds } from "../src/tools/footage/strip";
import { MCP_TOOLS } from "../src/mcp/registry";

const ctx = { userId: "u", organizationId: "org-1" } as never;
const K = "PIK1/sop sumsum/Man_eating_goat_marrow_soup_da1ed666.mp4";

function scene(i: number, extra: Partial<FootageScene> = {}): FootageScene {
  return {
    file_key: K,
    scene_index: i,
    start_seconds: 0,
    end_seconds: 10,
    scene_kind: "orang",
    summary: "cowok sedot sumsum",
    location_label: "PIK1",
    product_label: "sop sumsum",
    media_type: "video",
    thumb_storage_path: `org-1/thumbs/s${i}.jpg`,
    thumb_required: true,
    hijab: false,
    watermark_ui: false,
    lengkuas: false,
    meja_biru: true,
    usage_count: 5,
    banned: false,
    ban_reason: null,
    ...extra,
  };
}

const clip = {
  file_key: K,
  scenes: [
    scene(1, { strip_storage_path: "org-1/strips/s1.jpg", strip: { fps: 2, frames: 18, cols: 6, start: 0, labels: true } }),
    scene(2, { start_seconds: 10, end_seconds: 12 }),
  ],
} as unknown as FootageClip;
const getClip = async (_c: unknown, k: string) => {
  if (k !== K) throw new Error("not_found");
  return clip;
};
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe("footage.scenes.strip", () => {
  it("frame seconds follow start + n / fps", () => {
    expect(stripFrameSeconds({ fps: 2, frames: 4, start: 4.4 })).toEqual([4.4, 4.9, 5.4, 5.9]);
    expect(stripFrameSeconds({ fps: 1.8, frames: 3, start: 0 })).toEqual([0, 0.56, 1.11]);
  });

  it("returns the strip picture with the second of every frame, and lists scenes without a strip", async () => {
    const getImage = vi.fn(async () => jpg);
    const r = await stripFootageScenesResult(
      ctx,
      { scenes: [{ file_key: K, scene_index: 1 }, { file_key: K, scene_index: 2 }, { file_key: "x.mp4", scene_index: 1 }] },
      getClip as never,
      getImage,
    );
    expect(getImage).toHaveBeenCalledTimes(1);
    expect(getImage).toHaveBeenCalledWith(ctx, "org-1/strips/s1.jpg");
    const header = JSON.parse((r.mcpContent[0] as { text: string }).text);
    expect(header).toMatchObject({ scenes: 2, with_strip: 1, not_found: ["x.mp4 #1"], without_strip: [`${K} #2`] });
    const line = (r.mcpContent[1] as { text: string }).text;
    expect(line).toContain("18 frame, 2 fps, 6 kolom");
    expect(line).toContain("frame_seconds: 0, 0.5, 1, 1.5");
    expect(r.mcpContent[2]).toMatchObject({ type: "image", mimeType: "image/jpeg" });
    expect((r.mcpContent[3] as { text: string }).text).toContain("strip belum ada");
  });

  it("limits a call to 6 scenes", () => {
    const scenes = Array.from({ length: 7 }, (_, i) => ({ file_key: K, scene_index: i }));
    expect(stripFootageScenesInput.safeParse({ scenes }).success).toBe(false);
  });

  it("only serves strips under the organization's strips folder", async () => {
    const admin = { storage: { from: () => ({ download: async () => ({ data: new Blob([jpg]), error: null }) }) } } as never;
    await expect(downloadFootageStrip(admin, ctx, "org-1/strips/s1.jpg")).resolves.toBeInstanceOf(Uint8Array);
    await expect(downloadFootageStrip(admin, ctx, "org-2/strips/s1.jpg")).rejects.toThrow("forbidden");
    await expect(downloadFootageStrip(admin, ctx, "org-1/thumbs/s1.jpg")).rejects.toThrow("forbidden");
    await expect(downloadFootageStrip(admin, ctx, "org-1/strips/../x.jpg")).rejects.toThrow("forbidden");
  });

  it("is a content:read tool", () => {
    expect(MCP_TOOLS.find((t) => t.name === "footage.scenes.strip")?.scopes).toEqual(["content:read"]);
  });
});
