/** Facebook post IDs from Graph API use `{pageId}_{postId}`; feed webhooks may send either form. */
export function facebookPostMediaIdCandidates(
  postId: string,
  pageId: string,
): string[] {
  const trimmed = postId.trim();
  const page = pageId.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>([trimmed]);
  if (!page) return [...candidates];

  if (trimmed.includes("_")) {
    const suffix = trimmed.split("_").pop()?.trim();
    if (suffix) candidates.add(suffix);
    if (!trimmed.startsWith(`${page}_`)) {
      candidates.add(`${page}_${trimmed}`);
    }
  } else {
    candidates.add(`${page}_${trimmed}`);
  }

  return [...candidates];
}

export function canonicalFacebookPostMediaId(postId: string, pageId: string): string {
  const trimmed = postId.trim();
  const page = pageId.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes("_")) return trimmed;
  return page ? `${page}_${trimmed}` : trimmed;
}
