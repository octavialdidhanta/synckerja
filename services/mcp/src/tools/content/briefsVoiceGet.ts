import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const getBriefVoiceInput = z
  .object({
    plan_id: z.string().uuid(),
    clip_id: z.string().uuid().optional(),
    row_index: z.number().int().min(0).max(59).optional(),
    include_base64: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasClip = value.clip_id != null;
    const hasRow = value.row_index != null;
    if (hasClip === hasRow) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_input" });
    }
  });

export type GetBriefVoiceInput = {
  planId: string;
  clipId: string | null;
  rowIndex: number | null;
  includeBase64: boolean;
};

export type BriefVoiceGetClip = {
  id: string;
  row_index: number;
  file_name: string;
  spoken_text: string | null;
  mime_type: "audio/mpeg";
  duration_seconds: number | null;
  byte_length: number;
  /** GET this within 15 minutes; no auth header. Served from the MCP host so AI sandboxes can reach it. */
  download_url: string;
  download_expires_at: string;
  /** Only when include_base64 is true and the clip is at most 1 MB. */
  audio_base64?: string;
};

export type BriefVoiceGetResult = {
  plan_id: string;
  clip: BriefVoiceGetClip;
  how_to_read: string;
};

export const BRIEF_VOICE_GET_HOW_TO_READ =
  "One ElevenLabs VO clip for this content plan. " +
  "Call content.briefs.voice.list first, then pass plan_id and exactly one of clip_id or row_index. " +
  "row_index returns the newest clip for that shot. " +
  "To save the file, GET download_url within 15 minutes and write it to file_name in the content's vo folder, " +
  "for example: curl -fsSL -o \"vo/<file_name>\" \"<download_url>\". No auth header is needed: the link only opens this one clip and expires. " +
  "If the link expired, call this tool again. Error responses are JSON with error and next_step. " +
  "Do not use download_url from content.briefs.voice.list on a computer; its host is often blocked. " +
  "mime_type is audio/mpeg. duration_seconds is estimated from the MP3 bitrate; confirm with ffprobe before cutting. " +
  "Set include_base64 true only if you cannot make HTTP requests: audio_base64 then carries the file (at most 1 MB, otherwise clip_too_large). " +
  "A file that is not MP3 returns clip_not_mp3. Storage paths are not returned. This does not generate, delete, or change the clip.";

export type GetBriefVoiceClip = (
  ctx: McpAuthContext,
  input: GetBriefVoiceInput,
) => Promise<BriefVoiceGetResult>;

export function getBriefVoiceResult(
  ctx: McpAuthContext,
  args: unknown,
  get: GetBriefVoiceClip,
): Promise<BriefVoiceGetResult> {
  const parsed = getBriefVoiceInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return get(ctx, {
    planId: parsed.data.plan_id,
    clipId: parsed.data.clip_id ?? null,
    rowIndex: parsed.data.row_index ?? null,
    includeBase64: parsed.data.include_base64 === true,
  });
}
