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
  clip: BriefVoiceClipPublic;
  tagged_text: string | null;
  how_to_read: string;
};

export const BRIEF_VOICE_GENERATE_HOW_TO_READ =
  "Generates one ElevenLabs VO clip for a storyboard row using the organization's Voice AI settings. " +
  "Only the plan PIC can generate. If text is omitted, the vo cell for that row_index is used (or voice_over when the row has no vo). " +
  "download_url is a public HTTPS link for a phone tap. A desktop agent calls content.briefs.voice.get for the MP3 bytes. One row per call. Existing clips for other rows are unchanged; call content.briefs.voice.list to see all.";

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
