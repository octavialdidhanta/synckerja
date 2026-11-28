import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageClip, FootageScene } from "../../db/footage";
import type { McpContentBlock, McpContentResult } from "./view";

/**
 * footage.scenes.strip: for choosing in/out points inside a scene without the laptop file. The Synckerja Agent makes
 * one contact strip per video scene from the source file (a frame every half second, at most 18, left to right in
 * rows, each labelled with its second in the source clip) and keeps it in storage. This returns those strips as
 * pictures with the second of every frame, so a talent blinking, looking at the lens or a moment inside a long scene
 * can be avoided before a still preview.
 */
export const STRIP_MAX_SCENES = 6;

export const stripFootageScenesInput = z
  .object({
    scenes: z
      .array(z.object({ file_key: z.string().trim().min(1).max(2000), scene_index: z.number().int().min(1).max(10_000) }).strict())
      .min(1)
      .max(STRIP_MAX_SCENES),
  })
  .strict();

/** Second of every frame on the strip, in source-clip seconds (frame n at start + n / fps). */
export function stripFrameSeconds(strip: { fps: number; frames: number; start: number }): number[] {
  return Array.from({ length: strip.frames }, (_, n) => Math.round((strip.start + n / strip.fps) * 100) / 100);
}

function sceneLine(n: number, s: FootageScene): string {
  const end = s.end_seconds == null ? "?" : s.end_seconds.toFixed(2);
  return `${n}. ${s.file_key} #${s.scene_index} ${s.start_seconds.toFixed(2)}-${end}s [${s.scene_kind}] ${s.summary ?? ""}`;
}

export async function stripFootageScenesResult(
  ctx: McpAuthContext,
  args: unknown,
  getClip: (ctx: McpAuthContext, fileKey: string) => Promise<FootageClip>,
  getImage: (ctx: McpAuthContext, storagePath: string) => Promise<Uint8Array>,
): Promise<McpContentResult> {
  const parsed = stripFootageScenesInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const wanted = parsed.data.scenes;
  const clips = new Map<string, FootageClip | null>();
  await Promise.all(
    [...new Set(wanted.map((w) => w.file_key))].map(async (k) => {
      try {
        clips.set(k, await getClip(ctx, k));
      } catch (error) {
        if (error instanceof Error && /not_found/.test(error.message)) clips.set(k, null);
        else throw error;
      }
    }),
  );

  const notFound: string[] = [];
  const picked: FootageScene[] = [];
  for (const w of wanted) {
    const scene = clips.get(w.file_key)?.scenes.find((s) => s.scene_index === w.scene_index);
    if (scene) picked.push(scene);
    else notFound.push(`${w.file_key} #${w.scene_index}`);
  }

  const images = await Promise.all(
    picked.map(async (s) => {
      if (!s.strip_storage_path || !s.strip) return null;
      try {
        return await getImage(ctx, s.strip_storage_path);
      } catch {
        return null;
      }
    }),
  );

  const withoutStrip = picked.filter((_, i) => !images[i]).map((s) => `${s.file_key} #${s.scene_index}`);
  const content: McpContentBlock[] = [
    {
      type: "text",
      text: JSON.stringify({
        scenes: picked.length,
        with_strip: images.filter(Boolean).length,
        not_found: notFound,
        without_strip: withoutStrip,
        note:
          "Each strip is one scene: frames left to right, top to bottom, every 1/fps seconds, each labelled with its second in the source clip (frame_seconds lists them). " +
          "Pick in/out on those seconds: avoid frames with closed eyes, a look into the lens or anything Gaya baku or a scene note forbids. " +
          "A scene without a strip is not made yet (the Agent on the laptop makes them while idle): use footage.scenes.view, or the source file only if a frame-exact cut is needed.",
      }),
    },
  ];
  picked.forEach((s, i) => {
    const bytes = images[i];
    if (!bytes || !s.strip) {
      content.push({ type: "text", text: `${sceneLine(i + 1, s)} (strip belum ada)` });
      return;
    }
    content.push({
      type: "text",
      text: `${sceneLine(i + 1, s)} — ${s.strip.frames} frame, ${s.strip.fps} fps, ${s.strip.cols} kolom${s.strip.labels ? "" : ", tanpa label di gambar"}; frame_seconds: ${stripFrameSeconds(s.strip).join(", ")}`,
    });
    content.push({ type: "image", data: Buffer.from(bytes).toString("base64"), mimeType: "image/jpeg" });
  });
  return { mcpContent: content };
}
