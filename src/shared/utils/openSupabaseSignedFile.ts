import { supabase } from "@/shared/lib/supabaseClient";

export type OpenSignedFileResult =
  | { ok: true; signedUrl: string }
  | { ok: false; reason: "missing_path" | "sign_failed"; error?: unknown };

type Params = {
  bucket: string;
  /** Can be a storage path or a full URL. */
  filePath: string | null | undefined;
  expiresInSeconds?: number;
  /** Target passed to window.open. Defaults to `_blank`. */
  target?: "_blank" | "_self";
};

/**
 * Opens a Supabase Storage file in a new tab.
 * - If `filePath` is already a full URL, opens directly.
 * - Otherwise, creates a signed URL in the given bucket.
 */
export async function openSupabaseSignedFile({
  bucket,
  filePath,
  expiresInSeconds = 3600,
  target = "_blank",
}: Params): Promise<OpenSignedFileResult> {
  if (!filePath) return { ok: false, reason: "missing_path" };

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    window.open(filePath, target);
    return { ok: true, signedUrl: filePath };
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return { ok: false, reason: "sign_failed", error: error ?? new Error("No signedUrl") };
  }

  window.open(data.signedUrl, target);
  return { ok: true, signedUrl: data.signedUrl };
}

