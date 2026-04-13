import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";

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
