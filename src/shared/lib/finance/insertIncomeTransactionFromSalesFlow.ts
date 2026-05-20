import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared insert used by `useIncomeTransactions` and server-style flows (e.g. `createConvertedSalesActivity`).
 * Accepts `receipt_url` in the payload and maps it to `receipt_file_path` on the row.
 */
export async function insertIncomeTransactionFromSalesFlow(
  client: SupabaseClient,
  params: {
    organizationId: string;
    userId: string;
    transactionData: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  const { organizationId, userId, transactionData } = params;
  const {
    receipt_url: receiptUrlRaw,
    receipt_file: _receiptFile,
    active_organization_id: _legacyActiveOrg,
    organization_id: _ignoredOrg,
    user_id: _ignoredUser,
    created_by: _ignoredCreatedBy,
    ...rest
  } = transactionData;

  const insertRow: Record<string, unknown> = {
    ...rest,
    organization_id: organizationId,
    user_id: userId,
    created_by: userId,
  };

  const receiptUrl = typeof receiptUrlRaw === 'string' ? receiptUrlRaw.trim() : '';
  if (receiptUrl) {
    insertRow.receipt_file_path = receiptUrl;
  }
  delete insertRow.receipt_url;

  const { data, error } = await client.from('income_transactions').insert(insertRow).select().single();

  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}
