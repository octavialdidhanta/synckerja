import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

export const listBriefVoiceInput = z
  .object({
    plan_id: z.string().uuid(),
  })
  .strict();

export type BriefVoiceClipPublic = {
  id: string;
  row_index: number;
  file_name: string;
  spoken_text: string | null;
  download_url: string;
  created_at: string;
  /** Permanent storyboard row. Null on clips saved before row ids existed. */
  shot_id: string | null;
  /** True when this clip no longer matches the row's vo, or voice_over when that cell is empty. */
  stale?: boolean;
};

export type BriefVoiceListResult = {
  plan_id: string;
  count: number;
  clips: BriefVoiceClipPublic[];
  how_to_read: string;
};

export const BRIEF_VOICE_LIST_HOW_TO_READ =
  "clips are existing ElevenLabs VO files for this content plan (kind vo only). " +
  "row_index is the current storyboard position, starting at 0. shot_id is the permanent row id. download_url is a public HTTPS link for a phone tap. " +
  "A desktop agent that cannot open that link calls content.briefs.voice.get with plan_id and row_index or clip_id to receive the MP3 bytes. " +
  "storage paths are not returned. Empty clips means no VO has been generated yet in Office (or via content.briefs.voice.generate). " +
  "stale is true when this clip no longer matches that row's vo cell, or voice_over when the cell is empty. The file is kept and can still be downloaded; call content.briefs.voice.generate to replace it. " +
  "Use content.briefs.get for the script text; use this tool for the clip list.";

export type ListBriefVoiceClips = (
  ctx: McpAuthContext,
  planId: string,
) => Promise<BriefVoiceListResult>;

export function listBriefVoiceResult(
  ctx: McpAuthContext,
  args: unknown,
  list: ListBriefVoiceClips,
): Promise<BriefVoiceListResult> {
  const parsed = listBriefVoiceInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return list(ctx, parsed.data.plan_id);
}
