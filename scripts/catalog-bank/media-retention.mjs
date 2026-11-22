/** Shared rules for catalog media delete, restore, and purge.
 * The same grace and path pattern live in services/mcp/src/tools/catalog/mediaRetention.ts.
 */

export const CATALOG_MEDIA_GRACE_SECONDS = 2_592_000;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STORAGE_PATH = new RegExp(
  `^${UUID}/(?:previews/${UUID}\\.mp4|thumbs/${UUID}\\.jpg|photos/${UUID}\\.(?:jpg|jpeg|png|webp)|thumbs/references/[A-Za-z0-9_-]{1,80}/[A-Za-z0-9._-]{1,120})$`,
  "i",
);

export function catalogMediaRestorable(deletedAt, now = new Date()) {
  const deleted = new Date(deletedAt).getTime();
  return Number.isFinite(deleted) && deleted > now.getTime() - CATALOG_MEDIA_GRACE_SECONDS * 1000;
}

/** A purge may remove only a path this catalog bucket is allowed to store. */
export function allowedCatalogStoragePath(path) {
  return typeof path === "string"
    && path.length <= 500
    && !path.includes("..")
    && !path.includes("\\")
    && STORAGE_PATH.test(path);
}

export function pathsFromPurgeRow(row) {
  if (!row || !Array.isArray(row.paths)) return [];
  const found = [];
  for (const item of row.paths) {
    if (typeof item === "string") found.push(item);
    else if (item && typeof item.path === "string") found.push(item.path);
  }
  return found;
}
