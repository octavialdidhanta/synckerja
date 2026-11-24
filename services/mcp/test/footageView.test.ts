import { describe, expect, it } from "vitest";
import { downloadFootageThumb, type FootageClip, type FootageScene } from "../src/db/footage";
import { isMcpContentResult, viewFootageScenesInput, viewFootageScenesResult } from "../src/tools/footage/view";

const ctx = { userId: "u", organizationId: "org-1" } as never;

function scene(fileKey: string, i: number, extra: Partial<FootageScene> = {}): FootageScene {
  return {
    file_key: fileKey,
    scene_index: i,
    start_seconds: i * 2,
    end_seconds: i * 2 + 2,
    scene_kind: "produk",
    summary: `scene ${i}`,
    location_label: "PIK1",
    product_label: "sate kambing",
    media_type: "video",
    thumb_storage_path: `org-1/thumbs/${fileKey.length}-${i}.jpg`,
    thumb_required: true,
    hijab: false,
    watermark_ui: false,
    lengkuas: true,
    meja_biru: true,
    usage_count: 0,
    banned: false,
    ban_reason: null,
    ...extra,
  };
}

const clips: Record<string, FootageClip> = {
  "PIK1/sate/a.mp4": { file_key: "PIK1/sate/a.mp4", scenes: [scene("PIK1/sate/a.mp4", 0), scene("PIK1/sate/a.mp4", 1, { thumb_storage_path: null })] } as never,
  "PIK1/sate/b.mp4": { file_key: "PIK1/sate/b.mp4", scenes: [scene("PIK1/sate/b.mp4", 0, { banned: true, ban_reason: "senyum ke kamera", usage_count: 2 })] } as never,
};
const getClip = async (_c: unknown, k: string) => {
  const c = clips[k];
  if (!c) throw new Error("not_found");
  return c;
};
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const getThumb = async () => jpg;

describe("footage.scenes.view", () => {
  it("shows every scene of one clip as a labelled picture, and says which have no thumbnail", async () => {
    const out = await viewFootageScenesResult(ctx, { file_key: "PIK1/sate/a.mp4" }, getClip as never, getThumb);
    expect(isMcpContentResult(out)).toBe(true);
    const [header, ...rest] = out.mcpContent;
    expect(JSON.parse((header as { text: string }).text)).toMatchObject({ scenes: 2, with_image: 1, not_found: [] });
    expect(rest.map((b) => b.type)).toEqual(["text", "image", "text"]);
    expect((rest[0] as { text: string }).text).toBe("1. PIK1/sate/a.mp4 #0 0.00-2.00s [produk] scene 0");
    expect(rest[1]).toEqual({ type: "image", data: Buffer.from(jpg).toString("base64"), mimeType: "image/jpeg" });
    expect((rest[2] as { text: string }).text).toMatch(/belum ada thumbnail/);
  });

  it("takes chosen scenes across clips, flags banned ones and lists what it could not find", async () => {
    const out = await viewFootageScenesResult(
      ctx,
      {
        scenes: [
          { file_key: "PIK1/sate/b.mp4", scene_index: 0 },
          { file_key: "PIK1/sate/a.mp4", scene_index: 9 },
          { file_key: "INBOX/x.mp4", scene_index: 0 },
        ],
      },
      getClip as never,
      getThumb,
    );
    const header = JSON.parse((out.mcpContent[0] as { text: string }).text);
    expect(header.not_found).toEqual(["PIK1/sate/a.mp4 #9", "INBOX/x.mp4 #0"]);
    expect((out.mcpContent[1] as { text: string }).text).toContain("DILARANG: senyum ke kamera; dipakai 2x");
  });

  it("keeps going without a picture when one thumbnail cannot be downloaded, but rethrows other clip errors", async () => {
    const out = await viewFootageScenesResult(ctx, { file_key: "PIK1/sate/a.mp4" }, getClip as never, async () => {
      throw new Error("not_found");
    });
    expect(JSON.parse((out.mcpContent[0] as { text: string }).text).with_image).toBe(0);
    await expect(
      viewFootageScenesResult(ctx, { file_key: "x" }, (async () => {
        throw new Error("db down");
      }) as never, getThumb),
    ).rejects.toThrow("db down");
  });

  it("needs exactly one of file_key or scenes", () => {
    expect(viewFootageScenesInput.safeParse({}).success).toBe(false);
    expect(viewFootageScenesInput.safeParse({ file_key: "a", scenes: [{ file_key: "a", scene_index: 0 }] }).success).toBe(false);
    expect(viewFootageScenesInput.safeParse({ scenes: Array.from({ length: 25 }, (_, i) => ({ file_key: "a", scene_index: i })) }).success).toBe(false);
  });

  it("only downloads thumbnails of the active organization", async () => {
    let touched = false;
    const admin = {
      storage: {
        from: () => ({
          download: async () => {
            touched = true;
            return { data: new Blob([jpg]), error: null };
          },
        }),
      },
    } as never;
    await expect(downloadFootageThumb(admin, ctx, "org-2/thumbs/a.jpg")).rejects.toThrow("forbidden");
    await expect(downloadFootageThumb(admin, ctx, "org-1/thumbs/../../org-2/a.jpg")).rejects.toThrow("forbidden");
    expect(touched).toBe(false);
    expect(await downloadFootageThumb(admin, ctx, "org-1/thumbs/a.jpg")).toEqual(jpg);
  });
});
