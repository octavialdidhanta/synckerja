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
};

export type BriefVoiceListResult = {
  plan_id: string;
  count: number;
  clips: BriefVoiceClipPublic[];
  how_to_read: string;
};

export const BRIEF_VOICE_LIST_HOW_TO_READ =
  "clips are existing ElevenLabs VO files for this content plan (kind vo only). " +
  "row_index is the storyboard shot index starting at 0. download_url is a public HTTPS link: open or tap it to play or save the audio on phone. " +
  "storage paths are not returned. Empty clips means no VO has been generated yet in Office (or via content.briefs.voice.generate). " +
  "Use content.briefs.get for the script text; use this tool for download links.";

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
