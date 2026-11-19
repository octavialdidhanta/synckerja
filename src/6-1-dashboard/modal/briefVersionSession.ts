export function briefContentBundle(parts: {
  brief: string;
  concept: string;
  caption: string;
  link: string;
}): string {
  return [parts.brief, parts.concept, parts.caption, parts.link]
    .map((part) => part.trim())
    .join("\u001f");
}

/** One snapshot per open dialog, and only when the draft differs from what was loaded. */
export function shouldRecordBriefVersion(input: {
  recordedThisSession: boolean;
  baseline: string | null;
  draft: string;
}): boolean {
  if (input.recordedThisSession) return false;
  if (input.baseline === null) return false;
  return input.draft !== input.baseline;
}

/** Latest version number from a rejected save, or null when the error is something else. */
export function briefVersionConflictNumber(error: {
  message?: string | null;
  details?: string | null;
} | null): number | null {
  if (!error?.message?.includes("brief_version_conflict")) return null;
  const detail = error.details?.trim() ?? "";
  return /^\d+$/.test(detail) ? Number(detail) : null;
}
