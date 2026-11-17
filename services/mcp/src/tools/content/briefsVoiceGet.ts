import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const getBriefVoiceInput = z
  .object({
    plan_id: z.string().uuid(),
    clip_id: z.string().uuid().optional(),
    row_index: z.number().int().min(0).max(59).optional(),
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
};

export type BriefVoiceGetClip = {
  id: string;
  row_index: number;
  file_name: string;
  spoken_text: string | null;
  mime_type: "audio/mpeg";
  duration_seconds: number | null;
  byte_length: number;
  audio_base64: string;
};

export type BriefVoiceGetResult = {
  plan_id: string;
  clip: BriefVoiceGetClip;
  how_to_read: string;
};

export const BRIEF_VOICE_GET_HOW_TO_READ =
  "One ElevenLabs VO clip as MP3 bytes for this content plan. " +
  "Call content.briefs.voice.list first, then pass plan_id and exactly one of clip_id or row_index. " +
  "row_index returns the newest clip for that shot. audio_base64 is the file: decode it and save file_name into the content vo folder. " +
  "Do not open download_url from the list tool; the server already read the file. " +
  "mime_type is audio/mpeg. duration_seconds is estimated from the MP3 bitrate; confirm with ffprobe before cutting. " +
  "One clip per call. A file over 1 MB returns clip_too_large. A file that is not MP3 returns clip_not_mp3. " +
  "storage paths are not returned. This does not generate, delete, or change the clip.";

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
  });
}
