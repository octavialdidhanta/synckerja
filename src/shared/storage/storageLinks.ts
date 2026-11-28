/**
 * Pure helpers for Supabase Storage links inside stored text (no client import, so the MCP server can use them too).
 * A stored link, public or signed, identifies the object; readers swap it for a fresh signed link before showing it.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linkPattern(bucket: string): RegExp {
  return new RegExp(
    `https?://[^\\s"'<>()]+?/storage/v1/object/(?:public|sign|authenticated)/${escapeRegExp(bucket)}/([^\\s"'<>()?#]+)(?:\\?[^\\s"'<>()#]*)?`,
    "g",
  );
}

function decodePath(raw: string): string | null {
  try {
    const path = raw
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    return path && !path.split("/").includes("..") ? path : null;
  } catch {
    return null;
  }
}

/** Object path inside `bucket` from one stored link (public or signed); null for anything else. */
export function storagePathFromUrl(url: string | null | undefined, bucket: string): string | null {
  if (typeof url !== "string" || !url) return null;
  const hit = new RegExp(linkPattern(bucket).source).exec(url);
  return hit ? decodePath(hit[1]) : null;
}

/** Distinct object paths of every `bucket` link found in a text or HTML string. */
export function storagePathsInText(text: string | null | undefined, bucket: string): string[] {
  if (typeof text !== "string" || !text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(linkPattern(bucket))) {
    const path = decodePath(match[1]);
    if (path) found.add(path);
  }
  return [...found];
}

/** Replace every `bucket` link whose path is in `signed` with that signed link; other links stay. */
export function replaceStorageLinksInText(
  text: string,
  bucket: string,
  signed: ReadonlyMap<string, string>,
): string {
  if (signed.size === 0) return text;
  return text.replace(linkPattern(bucket), (whole, raw: string) => {
    const path = decodePath(raw);
    return (path && signed.get(path)) || whole;
  });
}
