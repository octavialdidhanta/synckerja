import { supabase, SUPABASE_URL } from "@/shared/lib/supabaseClient";

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

/** If URL points at this project's Storage object (public/authenticated path), return bucket + object key. */
function tryParseOurSupabaseStorageObject(
  fileUrl: string,
): { bucket: string; objectPath: string } | null {
  if (!SUPABASE_URL) return null;
  try {
    const u = new URL(fileUrl);
    const projectHost = new URL(SUPABASE_URL).hostname;
    if (u.hostname !== projectHost) return null;

    const m = u.pathname.match(
      /\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/,
    );
    if (!m) return null;

    return {
      bucket: m[1],
      objectPath: decodeURIComponent(m[2]),
    };
  } catch {
    return null;
  }
}

const FINANCE_RECEIPT_BUCKETS = ["purchase-documents", "expense-receipts"] as const;

/**
 * Returns a time-limited signed URL for previews (e.g. mobile `<img src>`) or custom openers.
 * - Relative paths: tries buckets in order (`preferPurchaseBucketFirst` picks primary).
 * - This project's Storage HTTPS URLs: signed; other HTTPS URLs returned as-is.
 */
export async function getFinanceReceiptSignedUrl(
  filePathOrUrl: string | null | undefined,
  options?: { preferPurchaseBucketFirst?: boolean; expiresInSeconds?: number },
): Promise<string | null> {
  const expiresInSeconds = options?.expiresInSeconds ?? 3600;
  const preferPurchase = options?.preferPurchaseBucketFirst ?? false;
  if (!filePathOrUrl) return null;

  if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
    const ref = tryParseOurSupabaseStorageObject(filePathOrUrl);
    if (ref) {
      const { data, error } = await supabase.storage
        .from(ref.bucket)
        .createSignedUrl(ref.objectPath, expiresInSeconds);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    }
    return filePathOrUrl;
  }

  const order = preferPurchase
    ? (["purchase-documents", "expense-receipts"] as const)
    : (["expense-receipts", "purchase-documents"] as const);
  for (const bucket of order) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePathOrUrl, expiresInSeconds);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return null;
}

/**
 * Opens purchase invoices or expense receipts: tries each bucket when `filePathOrUrl` is a storage key,
 * and signs Supabase Storage URLs for this project so private buckets work.
 */
export async function openSupabaseFinanceReceiptOrInvoice(
  filePathOrUrl: string | null | undefined,
  expiresInSeconds = 3600,
  target: "_blank" | "_self" = "_blank",
): Promise<OpenSignedFileResult> {
  if (!filePathOrUrl) return { ok: false, reason: "missing_path" };

  if (filePathOrUrl.startsWith("http://") || filePathOrUrl.startsWith("https://")) {
    return openSupabaseSignedFile({
      bucket: "purchase-documents",
      filePath: filePathOrUrl,
      expiresInSeconds,
      target,
    });
  }

  for (const bucket of FINANCE_RECEIPT_BUCKETS) {
    const result = await openSupabaseSignedFile({
      bucket,
      filePath: filePathOrUrl,
      expiresInSeconds,
      target,
    });
    if (result.ok) return result;
  }

  return { ok: false, reason: "sign_failed" };
}

/**
 * Opens a Supabase Storage file in a new tab.
 * - If `filePath` is a full URL to this project's Storage (public/authenticated path), creates a signed URL.
 * - If `filePath` is another full URL, opens it directly.
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
    const ref = tryParseOurSupabaseStorageObject(filePath);
    if (ref) {
      const { data, error } = await supabase.storage
        .from(ref.bucket)
        .createSignedUrl(ref.objectPath, expiresInSeconds);

      if (error || !data?.signedUrl) {
        return {
          ok: false,
          reason: "sign_failed",
          error: error ?? new Error("No signedUrl"),
        };
      }

      window.open(data.signedUrl, target);
      return { ok: true, signedUrl: data.signedUrl };
    }

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

