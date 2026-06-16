import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { EXPENSES_QUERY_KEY } from '@/shared/lib/expensesQueryKeys';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export interface CreateBankTransferParams {
  fromBankAccountId: string;
  toBankAccountId: string;
  amount: number;
  fee?: number;
  note?: string | null;
  transactionDate?: string;
  receiptFile?: File | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function normalizeReceiptMetadata(file: File): { extension: string; mimeType: string } {
  const rawType = (file.type || '').toLowerCase().trim();
  const byType = MIME_TO_EXT[rawType];
  if (byType) {
    return {
      extension: byType,
      mimeType: rawType === 'image/jpg' ? 'image/jpeg' : rawType,
    };
  }

  const name = (file.name || '').toLowerCase();
  const byName = name.endsWith('.jpeg') || name.endsWith('.jpg')
    ? 'jpg'
    : name.endsWith('.png')
      ? 'png'
      : name.endsWith('.webp')
        ? 'webp'
        : name.endsWith('.pdf')
          ? 'pdf'
          : 'bin';

  const mimeByExt =
    byName === 'jpg'
      ? 'image/jpeg'
      : byName === 'png'
        ? 'image/png'
        : byName === 'webp'
          ? 'image/webp'
          : byName === 'pdf'
            ? 'application/pdf'
            : (rawType || 'application/octet-stream');

  return { extension: byName, mimeType: mimeByExt };
}

function aggregatePostgrestError(
  error: PostgrestError | { message?: string; details?: string | null; hint?: string | null }
): string {
  const e = error as PostgrestError;
  const parts = [e.message, e.details, e.hint].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0
  );
  return parts.join(' — ');
}

function sanitizeServerMessageForUser(raw: string, max = 280): string {
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function mapRpcErrorMessage(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes('INSUFFICIENT_FUNDS')) return 'INSUFFICIENT_FUNDS';
  if (u.includes('SAME_ACCOUNT')) return 'SAME_ACCOUNT';
  if (u.includes('INVALID_SOURCE_ACCOUNT')) return 'INVALID_SOURCE_ACCOUNT';
  if (u.includes('INVALID_DESTINATION_ACCOUNT')) return 'INVALID_DESTINATION_ACCOUNT';
  if (u.includes('INVALID_AMOUNT')) return 'INVALID_AMOUNT';
  if (u.includes('INVALID_FEE')) return 'INVALID_FEE';
  if (u.includes('NOT AUTHENTICATED') || u.includes('JWT')) return 'NOT_AUTHENTICATED';
  if (u.includes('NO ACTIVE ORGANIZATION')) return 'NO_ORGANIZATION';
  if (u.includes('INTERNAL TRANSFER') && u.includes('NOT CONFIGURED')) return 'NOT_CONFIGURED';
  if (u.includes('INVALID INPUT SYNTAX FOR TYPE UUID') || u.includes('INVALID TEXT REPRESENTATION'))
    return 'INVALID_ID';
  if (u.includes('FOREIGN KEY CONSTRAINT') || u.includes('VIOLATES FOREIGN KEY')) return 'FK_VIOLATION';
  return 'GENERIC';
}

export function useCreateBankTransfer() {
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { t } = useAppTranslation();

  return useMutation({
    mutationFn: async (params: CreateBankTransferParams) => {
      const fromId = params.fromBankAccountId?.trim() || '';
      const toId = params.toBankAccountId?.trim() || '';
      if (!UUID_RE.test(fromId) || !UUID_RE.test(toId)) {
        const code = 'INVALID_ID';
        throw Object.assign(new Error(code), { code, displayMessage: 'Invalid bank account id' });
      }

      const amount = Number(params.amount);
      const fee = Number(params.fee ?? 0);
      if (!Number.isFinite(amount) || !Number.isFinite(fee)) {
        const code = 'INVALID_AMOUNT';
        throw Object.assign(new Error(code), { code, displayMessage: 'Invalid numeric amount' });
      }

      const dateStr = params.transactionDate?.trim() || new Date().toISOString().slice(0, 10);

      const { receiptFile, ...transferParams } = params;
      const { data, error } = await supabase.rpc('create_bank_transfer', {
        p_from_bank_account_id: fromId,
        p_to_bank_account_id: toId,
        p_amount: amount,
        p_fee: fee,
        p_note: transferParams.note?.trim() || null,
        p_transaction_date: dateStr,
      });

      if (error) {
        const aggregated = aggregatePostgrestError(error);
        const code = mapRpcErrorMessage(aggregated);
        throw Object.assign(new Error(code), { code, displayMessage: aggregated });
      }

      const transferResult = (data as {
        journal_id?: string;
        expense_id?: string | null;
        income_transaction_id?: string | null;
      } | null) ?? null;

      if (!receiptFile || !transferResult?.income_transaction_id || !user?.id || !organizationId) {
        return transferResult;
      }

      try {
        const { extension, mimeType } = normalizeReceiptMetadata(receiptFile);
        const fileName = `${Date.now()}-${transferResult.income_transaction_id}.${extension}`;
        const filePath = `${organizationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('income-receipts')
          .upload(filePath, receiptFile, {
            contentType: mimeType,
            upsert: false,
          });
        if (uploadError) {
          throw uploadError;
        }

        let updateQuery = supabase
          .from('income_transactions')
          .update({
            receipt_file_path: filePath,
            receipt_file_name: receiptFile.name,
            receipt_file_size: receiptFile.size,
            receipt_mime_type: mimeType,
          })
          .eq('id', transferResult.income_transaction_id)
          .eq('organization_id', organizationId);
        const { error: updateError } = await updateQuery;
        if (updateError) {
          throw updateError;
        }
      } catch {
        return {
          ...transferResult,
          receipt_attach_warning: true,
        };
      }

      return transferResult;
    },
    onSuccess: async (result) => {
      if (organizationId) {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['income-transactions', organizationId] }),
          queryClient.refetchQueries({ queryKey: [...EXPENSES_QUERY_KEY, organizationId] }),
          queryClient.refetchQueries({ queryKey: ['bank-account-balances', organizationId] }),
          queryClient.refetchQueries({ queryKey: ['income-transaction-summary', organizationId] }),
          queryClient.refetchQueries({ queryKey: ['income-metrics', organizationId] }),
          queryClient.refetchQueries({ queryKey: ['monthly-income-data', organizationId] }),
          queryClient.refetchQueries({ queryKey: ['expense-metrics', organizationId] }),
        ]);
      } else {
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['income-transactions'] }),
          queryClient.refetchQueries({ queryKey: EXPENSES_QUERY_KEY }),
          queryClient.refetchQueries({ queryKey: ['bank-account-balances'] }),
        ]);
      }
      toast.success(t('incomes.bankTransfer.success', 'Transfer completed'));
      if (result && typeof result === 'object' && 'receipt_attach_warning' in result && result.receipt_attach_warning) {
        toast.error(
          t(
            'incomes.bankTransfer.receiptAttachWarning',
            'Transfer succeeded, but receipt upload could not be attached.'
          )
        );
      }
    },
    onError: (err: Error & { code?: string; displayMessage?: string }) => {
      const code = err.code || mapRpcErrorMessage(err.message || '');
      const serverText = (err.displayMessage || err.message || '').trim();
      const genericWithDetail =
        serverText && code === 'GENERIC'
          ? t('incomes.bankTransfer.error.GENERIC_WITH_SERVER', 'Transfer failed: {{message}}', {
              message: sanitizeServerMessageForUser(serverText),
            })
          : null;

      const msg =
        code === 'INSUFFICIENT_FUNDS'
          ? t('incomes.bankTransfer.error.INSUFFICIENT_FUNDS', 'Insufficient balance for this transfer and fee.')
          : code === 'SAME_ACCOUNT'
            ? t('incomes.bankTransfer.error.SAME_ACCOUNT', 'Source and destination must be different.')
            : code === 'INVALID_SOURCE_ACCOUNT'
              ? t(
                  'incomes.bankTransfer.error.INVALID_SOURCE_ACCOUNT',
                  'Source account is invalid or inactive.'
                )
              : code === 'INVALID_DESTINATION_ACCOUNT'
                ? t(
                    'incomes.bankTransfer.error.INVALID_DESTINATION_ACCOUNT',
                    'Destination account is invalid or inactive.'
                  )
                : code === 'INVALID_AMOUNT'
                  ? t('incomes.bankTransfer.error.INVALID_AMOUNT', 'Enter a valid transfer amount.')
                  : code === 'INVALID_FEE'
                    ? t('incomes.bankTransfer.error.INVALID_FEE', 'Fee cannot be negative.')
                    : code === 'NOT_AUTHENTICATED'
                      ? t('incomes.bankTransfer.error.NOT_AUTHENTICATED', 'Please sign in again.')
                      : code === 'NO_ORGANIZATION'
                        ? t('incomes.bankTransfer.error.NO_ORGANIZATION', 'Select an organization before transferring.')
                        : code === 'NOT_CONFIGURED'
                          ? t(
                              'incomes.bankTransfer.error.NOT_CONFIGURED',
                              'Internal transfer is not set up on the server. Contact support.'
                            )
                          : code === 'INVALID_ID'
                            ? t(
                                'incomes.bankTransfer.error.INVALID_ID',
                                'Invalid account reference. Refresh the page and try again.'
                              )
                            : code === 'FK_VIOLATION'
                              ? t(
                                  'incomes.bankTransfer.error.FK_VIOLATION',
                                  'This transfer conflicts with existing data. Refresh and try again.'
                                )
                              : genericWithDetail ||
                                t('incomes.bankTransfer.error.GENERIC', 'Transfer failed. Please try again.');
      toast.error(msg);
    },
  });
}
