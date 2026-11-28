import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentBriefDetail } from "../../db/contentBriefs";
import type { BriefVoiceClipPublic } from "./briefsVoiceList";
import { isNoVoMarker } from "./voMarker";

export const generateBriefVoiceInput = z
  .object({
    plan_id: z.string().uuid(),
    row_index: z.number().int().min(0).max(59).optional(),
    /** Batch: these rows in one call (each from its own vo cell). */
    row_indexes: z.array(z.number().int().min(0).max(59)).min(1).max(60).optional(),
    /** Batch: every storyboard row that has its own vo text. */
    all_rows: z.boolean().optional(),
    /** Batch with all_rows: skip rows whose newest clip still matches the vo text. */
    only_missing: z.boolean().optional(),
    text: z.string().max(5000).optional(),
  })
  .strict()
  .refine((v) => [v.row_index !== undefined, v.row_indexes !== undefined, v.all_rows === true].filter(Boolean).length === 1, {
    message: "pass exactly one of row_index, row_indexes, all_rows",
  })
  .refine((v) => v.text === undefined || v.row_index !== undefined, { message: "text only with row_index" });

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
  /** Gemini spend cap / prepaid credits stopped auto-tag; the clip was still made without audio tags. */
  tag_warning?: { code: string; message: string };
  how_to_read: string;
};

export const BRIEF_VOICE_GENERATE_HOW_TO_READ =
  "Generates one ElevenLabs VO clip for a storyboard row using the organization's Voice AI settings. " +
  "Only the plan PIC can generate. If text is omitted, the vo cell for that row_index is used (or voice_over when the row has no vo). " +
  "download_url is a link on mcp.synckerja.com that serves this MP3 for 15 minutes without an auth header (same as content.briefs.voice.get): save it with a plain HTTP GET as file_name in the production vo folder. duration_seconds is estimated from the MP3; confirm with ffprobe before cutting. words are the spoken words with start/end seconds inside this clip (null when ElevenLabs gave no timings). phone_url is the public storage link for a phone tap only (often blocked on computers). If download_url is missing, call content.briefs.voice.get with the clip id. For several rows in one call use row_indexes or all_rows. Existing clips for other rows are unchanged; call content.briefs.voice.list to see all. tag_warning (code gemini_spend_cap or gemini_prepaid) means Gemini billing stopped auto-tag: the clip exists without audio tags; tell the owner to fix it in Google AI Studio.";

export type GenerateBriefVoiceBatchResult = {
  plan_id: string;
  clips: Array<GenerateBriefVoiceResult["clip"] & { row_index: number; tag_warning?: GenerateBriefVoiceResult["tag_warning"] }>;
  failed: Array<{ row_index: number; error: string }>;
  skipped: Array<{ row_index: number; reason: string }>;
  how_to_read: string;
};

export const BRIEF_VOICE_BATCH_HOW_TO_READ =
  "Batch VO: one clip per row in clips (row_index, download_url valid 15 minutes, words; tag_warning when Gemini billing stopped auto-tag, the clip is made without audio tags). Each failed row was retried once automatically; rows still in failed need a single-row call. " +
  "A row failed with voice_credit_exhausted means the organization's ElevenLabs balance is spent: stop, tell the owner to top up at https://elevenlabs.io/app/subscription (or turn on usage-based billing), and generate again with only_missing true after they say it is done; do not retry before that. " +
  "skipped lists rows without their own vo text (no_vo_text; batch never falls back to the whole voice_over), rows whose vo only marks natural sound or a pause such as (suara asli) or - (no_vo_marker; never read aloud, render.jobs.draft turns them into silence), or, with only_missing, rows whose clip is still current (clip_current). " +
  "No download is needed for a render with plan_id: the Agent (0.1.22+) fetches each row's newest clip into the production vo folder itself. Only for an older Agent save every clip with a plain HTTP GET as the file render.jobs.draft vo_rows expects (default vo/vo-<row+1>.mp3).";

/** Rows generated at the same time; ElevenLabs and the edge function take a few seconds each. */
const BATCH_CONCURRENCY = 3;
const VOICE_CREDIT_EXHAUSTED = "voice_credit_exhausted";

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

function rowTexts(brief: ContentBriefDetail): Array<{ row: number; text: string; hasVoice: boolean; stale: boolean }> {
  const shots = brief.storyboard?.sequences.flatMap((sequence) => sequence.shots) ?? [];
  return shots.map((shot, row) => {
    const s = shot as { vo?: string | null; has_voice?: boolean; voice_stale?: boolean };
    return { row, text: s.vo?.trim() || "", hasVoice: Boolean(s.has_voice), stale: Boolean(s.voice_stale) };
  });
}

async function generateBatch(
  ctx: McpAuthContext,
  planId: string,
  rows: number[],
  texts: Map<number, string>,
  generate: GenerateBriefVoice,
): Promise<{ clips: GenerateBriefVoiceBatchResult["clips"]; failed: GenerateBriefVoiceBatchResult["failed"] }> {
  const clips: GenerateBriefVoiceBatchResult["clips"] = [];
  const failed: GenerateBriefVoiceBatchResult["failed"] = [];
  const queue = [...rows];
  let creditOut = false;
  const one = async (row: number): Promise<void> => {
    // Once ElevenLabs says the balance is spent, every other row would fail the same way: stop calling.
    if (creditOut) {
      failed.push({ row_index: row, error: VOICE_CREDIT_EXHAUSTED });
      return;
    }
    const text = texts.get(row)!;
    let last = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await generate(ctx, { planId, rowIndex: row, text });
        clips.push({ ...res.clip, row_index: row, ...(res.tag_warning ? { tag_warning: res.tag_warning } : {}) });
        return;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
        if (last === VOICE_CREDIT_EXHAUSTED) {
          creditOut = true;
          break;
        }
      }
    }
    failed.push({ row_index: row, error: last });
  };
  const workers = Array.from({ length: Math.min(BATCH_CONCURRENCY, queue.length) }, async () => {
    for (let row = queue.shift(); row !== undefined; row = queue.shift()) await one(row);
  });
  await Promise.all(workers);
  clips.sort((a, b) => a.row_index - b.row_index);
  failed.sort((a, b) => a.row_index - b.row_index);
  return { clips, failed };
}

export async function generateBriefVoiceResult(
  ctx: McpAuthContext,
  args: unknown,
  generate: GenerateBriefVoice,
  getBrief: (ctx: McpAuthContext, id: string) => Promise<ContentBriefDetail>,
): Promise<GenerateBriefVoiceResult | GenerateBriefVoiceBatchResult> {
  const parsed = generateBriefVoiceInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  if (parsed.data.row_index === undefined) {
    const brief = await getBrief(ctx, parsed.data.plan_id);
    const all = rowTexts(brief);
    const wanted = parsed.data.all_rows ? all.map((r) => r.row) : [...new Set(parsed.data.row_indexes!)];
    const skipped: GenerateBriefVoiceBatchResult["skipped"] = [];
    const texts = new Map<number, string>();
    for (const row of wanted) {
      const r = all[row];
      if (!r || !r.text) skipped.push({ row_index: row, reason: "no_vo_text" });
      else if (isNoVoMarker(r.text)) skipped.push({ row_index: row, reason: "no_vo_marker" });
      else if (parsed.data.only_missing && r.hasVoice && !r.stale) skipped.push({ row_index: row, reason: "clip_current" });
      else texts.set(row, r.text);
    }
    const { clips, failed } = await generateBatch(ctx, parsed.data.plan_id, [...texts.keys()], texts, generate);
    return { plan_id: parsed.data.plan_id, clips, failed, skipped, how_to_read: BRIEF_VOICE_BATCH_HOW_TO_READ };
  }
  const rowIndex = parsed.data.row_index;
  let text = parsed.data.text?.trim() || "";
  if (!text) {
    const brief = await getBrief(ctx, parsed.data.plan_id);
    text = resolveNarration(brief, rowIndex) ?? "";
  }
  if (!text) throw new Error("invalid_input");
  if (isNoVoMarker(text)) {
    throw new Error(
      `invalid_input: row ${rowIndex} vo "${text.slice(0, 60)}" only marks natural sound or a pause; no clip is made (it would be read aloud). Use {silence: seconds, row_index: ${rowIndex}} in render.jobs.draft vo_rows, or pass text with the words to speak.`,
    );
  }
  return generate(ctx, {
    planId: parsed.data.plan_id,
    rowIndex,
    text,
  });
}
