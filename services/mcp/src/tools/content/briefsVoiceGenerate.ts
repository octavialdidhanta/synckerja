import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentBriefDetail } from "../../db/contentBriefs";
import type { BriefVoiceClipPublic } from "./briefsVoiceList";

export const generateBriefVoiceInput = z
  .object({
    plan_id: z.string().uuid(),
    row_index: z.number().int().min(0).max(59),
    text: z.string().max(5000).optional(),
  })
  .strict();

export type GenerateBriefVoiceInput = {
  planId: string;
  rowIndex: number;
  text: string;
};

export type GenerateBriefVoiceResult = {
  plan_id: string;
  clip: BriefVoiceClipPublic & {
    /** Public storage link, kept for a phone tap; blocked on many computers. */
    phone_url?: string;
    download_expires_at?: string;
    duration_seconds?: number | null;
    mime_type?: string;
    byte_length?: number;
    words?: Array<{ text: string; start: number; end: number }> | null;
  };
  tagged_text: string | null;
  how_to_read: string;
};

export const BRIEF_VOICE_GENERATE_HOW_TO_READ =
  "Generates one ElevenLabs VO clip for a storyboard row using the organization's Voice AI settings. " +
  "Only the plan PIC can generate. If text is omitted, the vo cell for that row_index is used (or voice_over when the row has no vo). " +
  "download_url is a link on mcp.synckerja.com that serves this MP3 for 15 minutes without an auth header (same as content.briefs.voice.get): save it with a plain HTTP GET as file_name in the production vo folder. duration_seconds is estimated from the MP3; confirm with ffprobe before cutting. words are the spoken words with start/end seconds inside this clip (null when ElevenLabs gave no timings). phone_url is the public storage link for a phone tap only (often blocked on computers). If download_url is missing, call content.briefs.voice.get with the clip id. One row per call. Existing clips for other rows are unchanged; call content.briefs.voice.list to see all.";

export type GenerateBriefVoice = (
  ctx: McpAuthContext,
  input: GenerateBriefVoiceInput,
) => Promise<GenerateBriefVoiceResult>;

function resolveNarration(brief: ContentBriefDetail, rowIndex: number): string | null {
  const shots = brief.storyboard?.sequences.flatMap((sequence) => sequence.shots) ?? [];
  const fromVo = shots[rowIndex]?.vo?.trim() || "";
  if (fromVo) return fromVo;
  return brief.voice_over?.trim() || null;
}

export async function generateBriefVoiceResult(
  ctx: McpAuthContext,
  args: unknown,
  generate: GenerateBriefVoice,
  getBrief: (ctx: McpAuthContext, id: string) => Promise<ContentBriefDetail>,
): Promise<GenerateBriefVoiceResult> {
  const parsed = generateBriefVoiceInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  let text = parsed.data.text?.trim() || "";
  if (!text) {
    const brief = await getBrief(ctx, parsed.data.plan_id);
    text = resolveNarration(brief, parsed.data.row_index) ?? "";
  }
  if (!text) throw new Error("invalid_input");
  return generate(ctx, {
    planId: parsed.data.plan_id,
    rowIndex: parsed.data.row_index,
    text,
  });
}
