/**
 * VO timeline from the storyboard rows: each row's clip is placed after the previous one (plus a short gap),
 * and subtitles are cut into short phrases from the clip's word timings. Changing one row's clip shifts
 * everything after it automatically: no hand-made VO_full and no hand-timed subtitles.
 */
export type VoWord = { text: string; start: number; end: number };

export type VoRowIn =
  | { kind: "clip"; row_index: number; file: string; duration: number; words: VoWord[] | null; gap_after?: number }
  | { kind: "silence"; row_index: number | null; seconds: number };

export type VoTimelineRow = {
  row_index: number | null;
  file: string | null;
  start: number;
  end: number;
};

export type VoSubtitle = { text: string; start: number; end: number; words: VoWord[] };

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Split words into phrases of at most `maxWords`, breaking after . ! ? always and after , when the phrase has 3+ words. */
export function phrases(words: VoWord[], maxWords = 6): VoWord[][] {
  const out: VoWord[][] = [];
  let cur: VoWord[] = [];
  for (const w of words) {
    cur.push(w);
    const hard = /[.!?…]$/.test(w.text);
    const soft = /[,;:]$/.test(w.text) && cur.length >= 3;
    if (hard || soft || cur.length >= maxWords) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  // Do not leave a lone short word dangling when it can join the phrase before it.
  for (let i = out.length - 1; i > 0; i--) {
    const p = out[i]!;
    const prev = out[i - 1]!;
    if (p.length === 1 && prev.length < maxWords && !/[.!?…]$/.test(prev[prev.length - 1]!.text)) {
      prev.push(...p);
      out.splice(i, 1);
    }
  }
  return out;
}

export function buildVoTimeline(
  rows: VoRowIn[],
  opts: { start?: number; gap?: number; maxWords?: number } = {},
): { parts: Array<{ file: string; at: number }>; timeline: VoTimelineRow[]; subtitles: VoSubtitle[]; end: number } {
  const gap = opts.gap ?? 0.2;
  let at = opts.start ?? 0.05;
  const parts: Array<{ file: string; at: number }> = [];
  const timeline: VoTimelineRow[] = [];
  const subtitles: VoSubtitle[] = [];
  rows.forEach((row, i) => {
    const last = i === rows.length - 1;
    if (row.kind === "silence") {
      timeline.push({ row_index: row.row_index, file: null, start: r3(at), end: r3(at + row.seconds) });
      at += row.seconds;
      return;
    }
    parts.push({ file: row.file, at: r3(at) });
    timeline.push({ row_index: row.row_index, file: row.file, start: r3(at), end: r3(at + row.duration) });
    const words = row.words ?? [];
    for (const ph of phrases(words, opts.maxWords)) {
      const first = ph[0]!;
      const lastWord = ph[ph.length - 1]!;
      subtitles.push({
        text: ph.map((w) => w.text).join(" "),
        start: r3(at + first.start),
        end: r3(at + lastWord.end + 0.1),
        words: ph.map((w) => ({ text: w.text, start: r3(at + w.start), end: r3(at + w.end) })),
      });
    }
    at += row.duration + (last ? 0 : (row.gap_after ?? gap));
  });
  // A subtitle never runs into the next one.
  for (let i = 0; i + 1 < subtitles.length; i++) {
    const a = subtitles[i]!;
    const b = subtitles[i + 1]!;
    if (a.end > b.start) a.end = r3(Math.max(a.start + 0.3, b.start - 0.02));
  }
  return { parts, timeline, subtitles, end: r3(at) };
}
