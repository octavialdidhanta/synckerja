/** Pure upload rules (unit-tested). */

export type PlanForUpload = {
  organization_id: string;
  approved: boolean | null;
  production_approved: boolean | null;
  content_type_name: string | null;
};

export type UploadBlock = "not_approved" | "production_locked" | "not_video_content";

/**
 * Same gates as the Office Google Drive link cell:
 * the brief must be approved, and once production is approved the deliverable is locked.
 */
export function uploadBlockReason(plan: PlanForUpload): UploadBlock | null {
  if (plan.approved !== true) return "not_approved";
  if (plan.production_approved === true) return "production_locked";
  const type = String(plan.content_type_name ?? "").trim().toLowerCase();
  if (type === "post" || type === "carousel") return "not_video_content";
  return null;
}

export type UploadedFileCheck = {
  versionId: string;
  folderId: string;
  expectedBytes: number;
  meta: {
    size: number;
    parents: string[];
    appProperties: Record<string, string>;
    trashed: boolean;
  } | null;
};

/** The Drive file must be the one created for THIS version: tag, folder and size all match. */
export function uploadedFileProblem(check: UploadedFileCheck, versionProp: string): string | null {
  const meta = check.meta;
  if (!meta) return "file_not_found";
  if (meta.trashed) return "file_trashed";
  if (meta.appProperties[versionProp] !== check.versionId) return "file_not_for_this_version";
  if (!meta.parents.includes(check.folderId)) return "file_wrong_folder";
  if (meta.size !== check.expectedBytes) return "size_mismatch";
  return null;
}

export function nextVersionNo(existing: number[]): number {
  return existing.reduce((max, n) => (Number.isFinite(n) && n > max ? n : max), 0) + 1;
}

export function secretMatches(provided: string, expected: string): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomTicket(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
