/**
 * ElevenLabs /with-timestamps returns one start/end time per character. Video editing needs words:
 * subtitles light up per word and cuts follow phrases. Audio tags such as "[conversational, playful]"
 * are not spoken, so they are dropped.
 */
export type ElevenAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

export type WordTiming = { text: string; start: number; end: number };

const round = (n: number) => Math.round(n * 1000) / 1000;

export function alignmentToWords(alignment: ElevenAlignment | null | undefined): WordTiming[] {
  const chars = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const words: WordTiming[] = [];
  let text = "";
  let start = 0;
  let end = 0;
  let inTag = false;
  const flush = () => {
    const t = text.trim();
    if (t && /[\p{L}\p{N}]/u.test(t)) words.push({ text: t, start: round(start), end: round(end) });
    text = "";
  };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] ?? "";
    if (c === "[") {
      flush();
      inTag = true;
      continue;
    }
    if (inTag) {
      if (c === "]") inTag = false;
      continue;
    }
    if (/\s/.test(c)) {
      flush();
      continue;
    }
    if (!text) start = Number(starts[i] ?? 0);
    text += c;
    end = Number(ends[i] ?? start);
  }
  flush();
  return words;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
