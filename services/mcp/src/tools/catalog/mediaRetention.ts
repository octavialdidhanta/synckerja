/** Same grace and path rules as scripts/catalog-bank/media-retention.mjs. */

export const CATALOG_MEDIA_GRACE_SECONDS = 2_592_000;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STORAGE_PATH = new RegExp(
  `^${UUID}/(?:previews/${UUID}\\.mp4|thumbs/${UUID}\\.jpg|photos/${UUID}\\.(?:jpg|jpeg|png|webp)|thumbs/references/[A-Za-z0-9_-]{1,80}/[A-Za-z0-9._-]{1,120})$`,
  "i",
);

export function catalogMediaRestorable(deletedAt: string, now = new Date()): boolean {
  const deleted = new Date(deletedAt).getTime();
  return Number.isFinite(deleted) && deleted > now.getTime() - CATALOG_MEDIA_GRACE_SECONDS * 1000;
}

export function allowedCatalogStoragePath(path: string): boolean {
  return typeof path === "string"
    && path.length <= 500
    && !path.includes("..")
    && !path.includes("\\")
    && STORAGE_PATH.test(path);
}

export function pathsFromPurgeRow(row: { paths?: unknown[] }): string[] {
  if (!row || !Array.isArray(row.paths)) return [];
  const found: string[] = [];
  for (const item of row.paths) {
    if (typeof item === "string") found.push(item);
    else if (item && typeof item === "object" && "path" in item && typeof item.path === "string") found.push(item.path);
  }
  return found;
}
