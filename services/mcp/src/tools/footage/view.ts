import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { FootageClip, FootageScene } from "../../db/footage";

/**
 * footage.scenes.view: the scene thumbnails as images the AI can look at, so it no longer builds contact sheets on a
 * laptop or VM to choose shots. One picture per scene (taken inside the scene by the Agent at scan time), labelled with
 * file_key, scene_index, time range and summary. Frame-exact in/out points still need the source file.
 */
export const VIEW_MAX_SCENES = 24;
const VIEW_MAX_CLIPS = 8;

export const viewFootageScenesInput = z
  .object({
    file_key: z.string().trim().min(1).max(2000).optional(),
    scenes: z
      .array(
        z
          .object({
            file_key: z.string().trim().min(1).max(2000),
            scene_index: z.number().int().min(0).max(10_000),
          })
          .strict(),
      )
      .min(1)
      .max(VIEW_MAX_SCENES)
      .optional(),
  })
  .strict()
  .refine((v) => Boolean(v.file_key) !== Boolean(v.scenes), {
    message: "Give either file_key (every scene of one clip) or scenes [{file_key, scene_index}], not both.",
  });

export type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/** A tool result that is sent as MCP content blocks as is, instead of one JSON text block. */
export type McpContentResult = { mcpContent: McpContentBlock[] };

export function isMcpContentResult(value: unknown): value is McpContentResult {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as { mcpContent?: unknown }).mcpContent);
}

function label(n: number, s: FootageScene): string {
  const end = s.end_seconds == null ? "?" : s.end_seconds.toFixed(2);
  const flags = [
    s.banned ? `DILARANG: ${s.ban_reason ?? "tanpa alasan"}` : null,
    s.hijab ? "hijab" : null,
    s.watermark_ui ? "watermark/UI" : null,
    s.usage_count > 0 ? `dipakai ${s.usage_count}x` : null,
  ].filter(Boolean);
  return `${n}. ${s.file_key} #${s.scene_index} ${s.start_seconds.toFixed(2)}-${end}s [${s.scene_kind}] ${s.summary ?? ""}${
    flags.length ? ` (${flags.join("; ")})` : ""
  }`;
}

export async function viewFootageScenesResult(
  ctx: McpAuthContext,
  args: unknown,
  getClip: (ctx: McpAuthContext, fileKey: string) => Promise<FootageClip>,
  getThumb: (ctx: McpAuthContext, storagePath: string) => Promise<Uint8Array>,
): Promise<McpContentResult> {
  const parsed = viewFootageScenesInput.safeParse(args);
  if (!parsed.success) {
    const where = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    throw new Error(`invalid_input: ${where}`);
  }
  const wanted = parsed.data.scenes ?? null;
  const keys = wanted ? [...new Set(wanted.map((w) => w.file_key))] : [parsed.data.file_key!];
  if (keys.length > VIEW_MAX_CLIPS) throw new Error(`invalid_input: at most ${VIEW_MAX_CLIPS} different clips per call`);

  const clips = new Map<string, FootageClip | null>();
  await Promise.all(
    keys.map(async (k) => {
      try {
        clips.set(k, await getClip(ctx, k));
      } catch (error) {
        if (error instanceof Error && /not_found/.test(error.message)) clips.set(k, null);
        else throw error;
      }
    }),
  );

  const missing: string[] = [];
  const picked: FootageScene[] = [];
  if (wanted) {
    for (const w of wanted) {
      const scene = clips.get(w.file_key)?.scenes.find((s) => s.scene_index === w.scene_index);
      if (scene) picked.push(scene);
      else missing.push(`${w.file_key} #${w.scene_index}`);
    }
  } else {
    const clip = clips.get(keys[0]!);
    if (!clip) missing.push(keys[0]!);
    else picked.push(...clip.scenes.slice(0, VIEW_MAX_SCENES));
  }

  const thumbs = await Promise.all(
    picked.map(async (s) => {
      if (!s.thumb_storage_path) return null;
      try {
        return await getThumb(ctx, s.thumb_storage_path);
      } catch {
        return null;
      }
    }),
  );

  const truncated = !wanted && (clips.get(keys[0]!)?.scenes.length ?? 0) > VIEW_MAX_SCENES;
  const header = {
    scenes: picked.length,
    with_image: thumbs.filter(Boolean).length,
    not_found: missing,
    truncated,
    note:
      "One picture per scene, numbered like the labels below. Use it to choose shots and check people, objects and setting. " +
      "For frame-exact in/out points, or a scene that changes inside, look at the source file itself.",
  };
  const content: McpContentBlock[] = [{ type: "text", text: JSON.stringify(header) }];
  picked.forEach((s, i) => {
    const bytes = thumbs[i];
    content.push({ type: "text", text: bytes ? label(i + 1, s) : `${label(i + 1, s)} (belum ada thumbnail)` });
    if (bytes) content.push({ type: "image", data: Buffer.from(bytes).toString("base64"), mimeType: "image/jpeg" });
  });
  return { mcpContent: content };
}
