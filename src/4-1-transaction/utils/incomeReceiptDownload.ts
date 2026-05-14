import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";
import { supabase } from "@/shared/lib/supabaseClient";

/**
 * Resolves `sales_activity_payments.receipt_url` / `receipt_file_path` for inline preview:
 * full `http(s)` URLs are returned as-is; storage object keys get a time-limited signed URL
 * (`income-receipts` is private — raw paths cannot be used as `<img src>`).
 */
export async function getIncomeReceiptDisplayUrl(
  pathOrUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!pathOrUrl || typeof pathOrUrl !== "string") return null;
  const t = pathOrUrl.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;

  const { data, error } = await supabase.storage.from("income-receipts").createSignedUrl(t, expiresInSeconds);
  if (error || !data?.signedUrl) {
    console.error("getIncomeReceiptDisplayUrl", error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Download income receipt: public URL opens in new tab; storage path downloads from `income-receipts` bucket.
 * Same behavior as the receipt button in `IncomeTransactionTable`.
 */
export async function downloadIncomeReceiptFromTransaction(
  transaction: Pick<IncomeTransactionWithRelations, "id" | "receipt_file_path" | "receipt_file_name">,
): Promise<void> {
  const path = transaction.receipt_file_path;
  if (!path || typeof path !== "string") return;

  try {
    if (path.startsWith("http")) {
      window.open(path, "_blank", "noopener,noreferrer");
      return;
    }

    const { supabase } = await import("@/shared/lib/supabaseClient");
    const { data, error } = await supabase.storage.from("income-receipts").download(path);
    if (error) {
      console.error("Error downloading receipt:", error);
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      transaction.receipt_file_name || `receipt-${String(transaction.id).substring(0, 8)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to download receipt:", err);
  }
}
