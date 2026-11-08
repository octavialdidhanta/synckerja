export const ORDER_COVER_SLIDE_LIMIT = 8;
export const ORDER_COVER_SLIDE_MS = 3_000;
/** Stored banner ceiling. The order frame is 430×240, so a larger file only costs bandwidth. */
export const ORDER_COVER_MAX_BYTES = 200 * 1024;
/** Longest side after resize. About 3× the 430 px order frame. */
export const ORDER_COVER_MAX_EDGE = 1200;
/** Refuse to decode a source photo above this. Phone photos are well under it. */
export const ORDER_COVER_SOURCE_MAX_BYTES = 15 * 1024 * 1024;

export function orderCoverOutputSize(
  width: number,
  height: number,
  maxEdge = ORDER_COVER_MAX_EDGE,
): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const longest = Math.max(safeWidth, safeHeight);
  if (longest <= maxEdge) return { width: safeWidth, height: safeHeight };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

export function synckerjaOrderCoverSlidePath(
  organizationId: string,
  outletId: string,
  fileName: string,
  slideId: string,
): string {
  const rawExt = fileName.includes(".") ? (fileName.split(".").pop() ?? "jpg") : "jpg";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const id = slideId.toLowerCase().replace(/[^a-z0-9]/g, "") || "slide";
  return `${organizationId.trim()}/synckerja-order/${outletId.trim()}/cover-${id}.${ext}`;
}

export function publicOrderCoverPaths(store: {
  cover_paths?: unknown;
  cover_path?: string | null;
}): string[] {
  const listed = Array.isArray(store.cover_paths)
    ? store.cover_paths.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  const paths = listed.length > 0 ? listed : store.cover_path?.trim() ? [store.cover_path.trim()] : [];
  const unique: string[] = [];
  for (const path of paths) {
    if (unique.includes(path)) continue;
    unique.push(path);
    if (unique.length >= ORDER_COVER_SLIDE_LIMIT) break;
  }
  return unique;
}

export function normalizeCoverPaths(paths: readonly string[]): string[] {
  return publicOrderCoverPaths({ cover_paths: [...paths] });
}

export function moveCoverPath(paths: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= paths.length || to >= paths.length) {
    return [...paths];
  }
  const next = [...paths];
  const [item] = next.splice(from, 1);
  if (!item) return [...paths];
  next.splice(to, 0, item);
  return next;
}
