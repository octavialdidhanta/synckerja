import { supabase } from "@/shared/lib/supabaseClient";
import type { KitchenCommitRpcLine } from "../lib/buildCommitLinesPayload";

export async function applyCatalogKitchenCommitStock(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  lines: KitchenCommitRpcLine[];
  commitBatchId?: string;
}): Promise<{ batchId?: string }> {
  if (args.lines.length === 0) return {};
  const { data, error } = await supabase.rpc("apply_catalog_kitchen_commit_stock", {
    p_organization_id: args.organizationId,
    p_outlet_id: args.outletId,
    p_session_id: args.sessionId,
    p_lines: args.lines,
    p_commit_batch_id: args.commitBatchId ?? null,
  });
  if (error) throw error;
  const batchId =
    data && typeof data === "object" && "batch_id" in data
      ? String((data as { batch_id?: string }).batch_id ?? "")
      : undefined;
  return { batchId: batchId || undefined };
}

export async function reverseCatalogKitchenCommit(args: {
  organizationId: string;
  sessionId: string;
  reverseId: string;
  lines?: KitchenCommitRpcLine[] | null;
}): Promise<void> {
  const { error } = await supabase.rpc("reverse_catalog_kitchen_commit", {
    p_organization_id: args.organizationId,
    p_session_id: args.sessionId,
    p_reverse_id: args.reverseId,
    p_lines: args.lines ?? null,
  });
  if (error) throw error;
}
