/**
 * Shots cut from the VO timeline: each storyboard row's slot (from its VO start to the next row's start) is shared
 * by the clips given for that row, and every cut is kept inside one catalog scene so no frame of a neighbouring
 * scene flashes in and no shot runs through a scene change.
 */
import type { VoTimelineRow } from "./voTimeline";

export type RowShotIn = { file_key: string; in?: number; label?: string };
export type SceneInfo = { duration_seconds: number | null; scene_starts?: number[] } | null;
export type AutoShot = { file_key: string; in: number; out: number; label?: string };

const FPS = 30;
const EDGE = 0.05;
const frame = (n: number) => Math.round(n * FPS) / FPS;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** [start, end) of every scene of a clip. Without scene data the whole clip is one scene. */
export function sceneBounds(info: SceneInfo): Array<[number, number]> {
  const dur = info?.duration_seconds ?? Infinity;
  const starts = [0, ...(info?.scene_starts ?? []).filter((t) => t > 0 && t < dur)].sort((a, b) => a - b);
  return starts.map((s, i) => [s, i + 1 < starts.length ? starts[i + 1]! : dur]);
}

/**
 * Place `want` seconds of a clip inside the scene that holds `hint` (default the clip start). Returns the in/out
 * and how many seconds the scene could not give.
 */
export function fitInScene(info: SceneInfo, hint: number, want: number): { in: number; out: number; short: number } {
  const scenes = sceneBounds(info);
  const [s, e] = scenes.find(([a, b]) => hint >= a && hint < b) ?? scenes[scenes.length - 1]!;
  const lo = s === 0 ? 0 : s + EDGE;
  const hi = Number.isFinite(e) ? e - EDGE : Infinity;
  let start = Math.max(hint, lo);
  if (start + want > hi) start = Math.max(lo, hi - want);
  const end = Math.min(start + want, hi);
  return { in: r3(frame(start)), out: r3(frame(end)), short: r3(Math.max(0, want - (end - start))) };
}

/**
 * Shots for the rows that came with clips. Rows without clips get none (the warning lists them).
 * `tail` is how long the last row runs past its VO (room before the outro).
 */
export function autoShots(
  timeline: VoTimelineRow[],
  rowShots: Array<RowShotIn[] | undefined>,
  lookup: Map<string, SceneInfo>,
  tail = 0.3,
): { shots: AutoShot[]; warnings: string[] } {
  const shots: AutoShot[] = [];
  const warnings: string[] = [];
  timeline.forEach((row, i) => {
    const clips = rowShots[i];
    const label = row.row_index != null ? `baris ${row.row_index}` : `jeda ${i}`;
    if (!clips?.length) {
      warnings.push(`${label}: tidak ada shot (isi vo_rows[${i}].shots).`);
      return;
    }
    const from = i === 0 ? 0 : row.start;
    const to = i + 1 < timeline.length ? timeline[i + 1]!.start : row.end + tail;
    let carry = 0;
    clips.forEach((c, k) => {
      const share = (to - from) / clips.length;
      const fit = fitInScene(lookup.get(c.file_key) ?? null, c.in ?? 0, share + carry);
      carry = fit.short;
      shots.push({ file_key: c.file_key, in: fit.in, out: fit.out, ...(c.label ? { label: c.label } : {}) });
      if (k === clips.length - 1 && carry > 0.04) {
        warnings.push(`${label}: scene terlalu pendek, kurang ${carry.toFixed(2)} s — tambah shot di baris ini atau pilih scene lain.`);
      }
    });
  });
  return { shots, warnings };
}
