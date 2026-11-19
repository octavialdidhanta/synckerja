type ShotClip = {
  kind?: string;
  shot_id?: string | null;
  row_index: number;
};

/** A clip follows its permanent shot id. A clip saved before ids existed still follows row_index. */
export function clipBelongsToShot(clip: ShotClip, rowIndex: number, shotId: string | null): boolean {
  if (clip.kind && clip.kind !== "vo") return false;
  if (clip.shot_id) {
    return shotId ? clip.shot_id === shotId : clip.row_index === rowIndex;
  }
  return clip.row_index === rowIndex;
}
