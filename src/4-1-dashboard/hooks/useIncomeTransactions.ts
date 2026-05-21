import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IncomeTransactionWithRelations, CreateIncomeTransactionData } from '../types';
import { useBankAccountBalances } from '@/shared/hooks/finance/useBankAccountBalances';
import { deleteIncomeTransactionForOrg } from '@/shared/lib/finance/deleteIncomeTransactionForOrg';
import { refetchIncomeModuleQueries } from '@/shared/lib/finance/refetchIncomeModuleQueries';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import {
  isIncomeAllocationComplete,
  isIncomeAllocationIncomplete,
} from '../utils/incomeAllocationStatus';

const ALLOCATION_FIELD_KEYS = ['income_type_id', 'category_id', 'bank_account_id', 'status'] as const;

/** Postgres UUID columns must get NULL, not "", when unset. */
function uuidOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function aggregatePostgrestError(
  error: PostgrestError | { message?: string; details?: string | null; hint?: string | null }
): string {
  const parts = [error.message, (error as PostgrestError).details, (error as PostgrestError).hint].filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0
  );
  return parts.join(' — ');
}

function sanitizeUuidMessageForToast(raw: string, max = 220): string {
  const one = raw.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

const INCOME_UPDATE_UUID_FIELDS = [
  'bank_account_id',
  'income_type_id',
  'category_id',
  'service_id',
  'sub_service_id',
] as const;

const INCOME_UPDATE_ALLOWED_KEYS = new Set<string>([
  'transaction_date',
  'amount',
  'customer_name',
  'payment_method',
  ...INCOME_UPDATE_UUID_FIELDS,
  'is_recurring',
  'recurring_frequency',
  'description',
  'status',
  'transaction_reference',
]);

async function resolveIncomeCategoryIdForCustomLabel(
  organizationId: string,
  incomeTypeId: string,
  label: string
): Promise<string | null> {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const { data: rows, error: selErr } = await supabase
    .from('income_categories')
    .select('id, name')
    .eq('income_types_id', incomeTypeId)
    .eq('is_active', true)
    .or(`organization_id.eq.${organizationId},organization_id.is.null`);

  if (selErr) throw selErr;
  const lower = trimmed.toLowerCase();
  const found = rows?.find((c) => (c.name ?? '').trim().toLowerCase() === lower);
  if (found?.id) return found.id;

  const { data: inserted, error: insErr } = await supabase
    .from('income_categories')
    .insert({
      name: trimmed,
      income_types_id: incomeTypeId,
      organization_id: organizationId,
      is_active: true,
    })
    .select('id')
    .single();

  if (insErr) throw insErr;
  return inserted?.id ?? null;
}

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

  const mimeByExt = byName === 'jpg'
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

export const useIncomeTransactions = () => {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { organizationId } = useCurrentOrg();
  const { updateBalance } = useBankAccountBalances();
  const { isOwner, isAdmin } = useCentralizedUserData();
  const canAllocateIncome = isOwner || isAdmin;

  const { data: incomeTransactions = [], isLoading, isPending, error, refetch } = useQuery({
    queryKey: ['income-transactions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const [txRes, allocRes, btjRes] = await Promise.all([
        supabase
          .from('income_transactions')
          .select(
            `
          *,
          income_types(name),
          income_categories(name),
          services(name),
          sub_services(name),
          bank_accounts (
            id,
            name,
            bank_name,
            account_number,
            account_holder
          )
        `
          )
          .eq('organization_id', organizationId)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('income_allocations')
          .select('income_transaction_id, amount')
          .eq('organization_id', organizationId),
        supabase
          .from('bank_transfer_journals')
          .select('income_transaction_id')
          .eq('organization_id', organizationId)
          .not('income_transaction_id', 'is', null),
      ]);

      if (txRes.error) throw txRes.error;

      const allocatedByIncome: Record<string, number> = {};
      if (!allocRes.error && allocRes.data) {
        for (const row of allocRes.data as { income_transaction_id: string; amount: unknown }[]) {
          const id = row.income_transaction_id;
          const a = parseFloat(String(row.amount ?? 0));
          if (!id || !Number.isFinite(a)) continue;
          allocatedByIncome[id] = (allocatedByIncome[id] ?? 0) + a;
        }
      }

      const transferIncomeIds = new Set<string>();
      if (!btjRes.error && btjRes.data) {
        for (const row of btjRes.data as { income_transaction_id: string | null }[]) {
          if (row.income_transaction_id) transferIncomeIds.add(row.income_transaction_id);
        }
      }

      const rows = txRes.data as IncomeTransactionWithRelations[];
      return rows.map((row) => {
        const allocated = allocatedByIncome[row.id] ?? 0;
        return {
          ...row,
          allocated_amount: allocated,
          has_income_allocations: allocated > 1e-9,
          is_legacy_bank_transfer_income: transferIncomeIds.has(row.id),
        };
      });
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const createMutation = useMutation({
    mutationFn: async (newTransaction: CreateIncomeTransactionData) => {
      if (!user?.id || !organizationId) {
        throw new Error('User not authenticated or no organization selected');
      }

      let receipt_file_path = null;
      let receipt_file_name = null;
      let receipt_file_size = null;
      let receipt_mime_type = null;

      // Handle file upload if present
      if (newTransaction.receipt_file) {
        const file = newTransaction.receipt_file;
        const { extension, mimeType } = normalizeReceiptMetadata(file);
        const fileName = `${Date.now()}.${extension}`;
        const filePath = `${organizationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('income-receipts')
          .upload(filePath, file, {
            contentType: mimeType,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        receipt_file_path = filePath;
        receipt_file_name = file.name;
        receipt_file_size = file.size;
        receipt_mime_type = mimeType;
      } else if (newTransaction.receipt_url) {
        // Fallback: use existing receipt URL from sales activity
        const url = newTransaction.receipt_url.trim();
        if (url) {
          receipt_file_path = url;
          try {
            const parsed = new URL(url);
            const last = parsed.pathname.split('/').pop() || 'receipt';
            receipt_file_name = decodeURIComponent(last);
          } catch {
            receipt_file_name = 'receipt';
          }
          // Size and mime type are unknown for external URLs
          receipt_file_size = null;
          receipt_mime_type = null;
        }
      }

      const {
        receipt_file,
        receipt_url,
        transaction_reference: txRefInput,
        custom_category_name,
        ...transactionData
      } = newTransaction;

      let categoryIdForInsert = transactionData.category_id ?? null;
      const customCat = custom_category_name?.trim();
      if (customCat && transactionData.income_type_id) {
        categoryIdForInsert = await resolveIncomeCategoryIdForCustomLabel(
          organizationId,
          transactionData.income_type_id,
          customCat
        );
      }

      const refTrimmed = txRefInput?.trim() ?? null;
      const refForDb =
        refTrimmed && refTrimmed.length > 0 ? refTrimmed : null;

      const bankIdForInsert = uuidOrNull(transactionData.bank_account_id);
      const typeIdForInsert = uuidOrNull(transactionData.income_type_id);
      const categoryIdResolved = categoryIdForInsert ?? uuidOrNull(transactionData.category_id);
      const allocationComplete = isIncomeAllocationComplete({
        income_type_id: typeIdForInsert,
        category_id: categoryIdResolved,
        bank_account_id: bankIdForInsert,
      });
      const statusForInsert =
        transactionData.status === 'cancelled'
          ? 'cancelled'
          : allocationComplete
            ? 'completed'
            : 'pending';

      const { data, error } = await supabase
        .from('income_transactions')
        .insert({
          ...transactionData,
          category_id: categoryIdResolved,
          bank_account_id: bankIdForInsert,
          income_type_id: typeIdForInsert,
          service_id: uuidOrNull(transactionData.service_id),
          sub_service_id: uuidOrNull(transactionData.sub_service_id),
          organization_id: organizationId,
          user_id: user.id,
          created_by: user.id,
          receipt_file_path,
          receipt_file_name,
          receipt_file_size,
          receipt_mime_type,
          transaction_reference: refForDb,
          status: statusForInsert,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Credit balance only when allocation is complete (pending + preset bank waits for finance allocation)
      const bankForBalance = uuidOrNull(newTransaction.bank_account_id);
      if (bankForBalance && data?.id && allocationComplete) {
        try {
          await updateBalance(
            bankForBalance,
            newTransaction.amount, // Positive for income
            'income',
            data.id,
            `Income: ${newTransaction.description || newTransaction.customer_name || 'Transaction'}`
          );
        } catch (balanceError) {
          console.error('Error updating bank account balance:', balanceError);
          // Don't fail the income creation if balance update fails
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['income-categories'] });
      queryClient.invalidateQueries({ queryKey: ['income-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-income-data'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['bank-account-balances'] });
      queryClient.invalidateQueries({ queryKey: ['expense-metrics'] });
      toast({
        title: "Success",
        description: "Income transaction created successfully",
      });
    },
    onError: (error) => {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      const rawMessage =
        typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';
      const msg = rawMessage;
      if (
        code === '23505' ||
        /duplicate key/i.test(msg) ||
        /unique constraint/i.test(msg) ||
        /idx_income_transactions_org_transaction_ref/i.test(msg)
      ) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'incomes.duplicateTransactionReference',
            'An income transaction with this Transaction ID already exists in your organization.'
          ),
          variant: 'destructive',
        });
        console.error('Error creating income transaction:', error);
        return;
      }
      const fallbackMessage = "Failed to create income transaction";
      const detailedMessage = rawMessage.trim() || fallbackMessage;
      toast({
        title: "Error",
        description: detailedMessage,
        variant: "destructive",
      });
      console.error('Error creating income transaction:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      custom_category_name: customCategoryFromForm,
      ...updates
    }: Partial<IncomeTransactionWithRelations> & { id: string; custom_category_name?: string }) => {
      const touchesAllocationField = ALLOCATION_FIELD_KEYS.some((key) => key in updates);
      if (touchesAllocationField && !canAllocateIncome) {
        throw new Error('INCOME_ALLOCATION_FORBIDDEN');
      }

      // Get old transaction data to calculate balance difference and merge allocation status
      const { data: oldTransaction } = await supabase
        .from('income_transactions')
        .select('bank_account_id, amount, income_type_id, category_id, status')
        .eq('id', id)
        .single();

      // Validate and clean recurring_frequency
      // Constraint requires: recurring_frequency must be one of: 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', or NULL
      const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
      const cleanedUpdates: Record<string, unknown> = {};
      for (const key of Object.keys(updates)) {
        if (!INCOME_UPDATE_ALLOWED_KEYS.has(key)) continue;
        const v = (updates as Record<string, unknown>)[key];
        if ((INCOME_UPDATE_UUID_FIELDS as readonly string[]).includes(key)) {
          cleanedUpdates[key] = uuidOrNull(v);
        } else {
          cleanedUpdates[key] = v;
        }
      }

      // Match create flow: income type "Other" uses free-text category → resolve/create income_categories row
      if (customCategoryFromForm !== undefined && organizationId) {
        let typeId = uuidOrNull(cleanedUpdates.income_type_id) ?? uuidOrNull(updates.income_type_id);
        if (!typeId) {
          const { data: row } = await supabase
            .from('income_transactions')
            .select('income_type_id')
            .eq('id', id)
            .single();
          typeId = uuidOrNull(row?.income_type_id);
        }
        const trimmed = String(customCategoryFromForm).trim();
        if (trimmed && typeId) {
          cleanedUpdates.category_id = await resolveIncomeCategoryIdForCustomLabel(
            organizationId,
            typeId,
            trimmed
          );
        } else {
          cleanedUpdates.category_id = null;
        }
      }
      
      // Handle recurring_frequency validation
      if ('recurring_frequency' in cleanedUpdates) {
        const freq = cleanedUpdates.recurring_frequency;
        
        // If empty string or invalid value, set to null
        if (!freq || freq === '' || (typeof freq === 'string' && !validFrequencies.includes(freq))) {
          cleanedUpdates.recurring_frequency = null;
        }
      }
      
      // If is_recurring is explicitly false, ensure recurring_frequency is null
      if ('is_recurring' in cleanedUpdates && cleanedUpdates.is_recurring === false) {
        cleanedUpdates.recurring_frequency = null;
      }

      // If is_recurring is not set but recurring_frequency is invalid, set to null
      if (!('is_recurring' in cleanedUpdates) && 'recurring_frequency' in cleanedUpdates) {
        const freq = cleanedUpdates.recurring_frequency;
        if (!freq || freq === '' || (typeof freq === 'string' && !validFrequencies.includes(freq))) {
          cleanedUpdates.recurring_frequency = null;
        }
      }

      const mergedForAllocation = {
        income_type_id:
          'income_type_id' in cleanedUpdates
            ? (cleanedUpdates.income_type_id as string | null)
            : oldTransaction?.income_type_id ?? null,
        category_id:
          'category_id' in cleanedUpdates
            ? (cleanedUpdates.category_id as string | null)
            : oldTransaction?.category_id ?? null,
        bank_account_id:
          'bank_account_id' in cleanedUpdates
            ? (cleanedUpdates.bank_account_id as string | null)
            : oldTransaction?.bank_account_id ?? null,
      };
      if (oldTransaction?.status !== 'cancelled' && !('status' in cleanedUpdates)) {
        cleanedUpdates.status = isIncomeAllocationComplete(mergedForAllocation)
          ? 'completed'
          : 'pending';
      }

      const { data, error } = await supabase
        .from('income_transactions')
        .update(cleanedUpdates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Resolve bank after update: form may send null to clear (null ?? old would wrongly keep old)
      let newBankAccountId: string | null;
      if ('bank_account_id' in updates) {
        const v = updates.bank_account_id;
        newBankAccountId = v && String(v).trim() ? String(v).trim() : null;
      } else {
        newBankAccountId = oldTransaction?.bank_account_id ?? null;
      }

      const newAmount = updates.amount != null && updates.amount !== ''
        ? parseFloat(updates.amount.toString())
        : parseFloat((oldTransaction?.amount ?? 0).toString());
      const oldBankId = oldTransaction?.bank_account_id ?? null;
      const oldAmount =
        oldTransaction?.amount != null ? parseFloat(oldTransaction.amount.toString()) : 0;
      const descBase = updates.description || updates.customer_name || data.description || data.customer_name || 'Transaction';

      const wasAllocIncomplete =
        oldTransaction &&
        isIncomeAllocationIncomplete({
          income_type_id: oldTransaction.income_type_id,
          category_id: oldTransaction.category_id,
          bank_account_id: oldTransaction.bank_account_id,
        });
      const nowAllocComplete = isIncomeAllocationComplete(mergedForAllocation);

      if (data?.id) {
        try {
          if (newBankAccountId) {
            if (
              wasAllocIncomplete &&
              nowAllocComplete &&
              oldBankId === newBankAccountId
            ) {
              await updateBalance(
                newBankAccountId,
                newAmount,
                'income',
                data.id,
                `Income: ${descBase}`
              );
            } else if (oldBankId && oldBankId !== newBankAccountId) {
              // Moved to another account: remove full old amount from old, add new amount to new
              await updateBalance(
                oldBankId,
                -oldAmount,
                'expense',
                data.id,
                `Income moved: ${descBase}`
              );
              await updateBalance(
                newBankAccountId,
                newAmount,
                'income',
                data.id,
                `Income: ${descBase}`
              );
            } else if (oldBankId === newBankAccountId) {
              // Same account: only apply the difference (avoid double-counting on edit)
              const delta = newAmount - oldAmount;
              if (Math.abs(delta) > 1e-6) {
                await updateBalance(
                  newBankAccountId,
                  delta,
                  'income',
                  data.id,
                  `Income updated: ${descBase}`
                );
              }
            } else {
              // No bank on old row (e.g. first time linking): credit full new amount
              await updateBalance(
                newBankAccountId,
                newAmount,
                'income',
                data.id,
                `Income: ${descBase}`
              );
            }
          } else if (oldBankId) {
            // Bank account removed from transaction: reverse prior credit
            await updateBalance(
              oldBankId,
              -oldAmount,
              'expense',
              data.id,
              `Income updated (unlinked): ${descBase}`
            );
          }
        } catch (balanceError) {
          console.error('Error updating bank account balance:', balanceError);
          // Don't fail the income update if balance update fails
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['income-categories'] });
      queryClient.invalidateQueries({ queryKey: ['income-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-income-data'] });
      queryClient.invalidateQueries({ queryKey: ['bank-account-balances'] });
      toast({
        title: t('common.success', 'Success'),
        description: t('incomes.update.success', 'Income transaction updated successfully'),
      });
    },
    onError: (error: PostgrestError | Error) => {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as PostgrestError).code) : '';
      const aggregated = typeof error === 'object' && error !== null && 'message' in error
        ? aggregatePostgrestError(error as PostgrestError)
        : String(error);
      const msgUpper = aggregated.toUpperCase();

      if (msgUpper.includes('INCOME_ALLOCATION_FORBIDDEN')) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'incomes.allocation.forbiddenAllocate',
            'Only Owner or Admin can assign income type, category, and bank account.'
          ),
          variant: 'destructive',
        });
        console.error('Error updating income transaction:', error);
        return;
      }

      if (msgUpper.includes('INCOME_HAS_ALLOCATIONS')) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'incomes.update.error.lockedByAllocation',
            'This income is linked to an expense or debt payment. Remove the allocation by deleting or adjusting that payment before changing amount, account, or classification.'
          ),
          variant: 'destructive',
        });
        console.error('Error updating income transaction:', error);
        return;
      }

      if (code === '22P02' || /INVALID INPUT SYNTAX FOR TYPE UUID/i.test(aggregated)) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'incomes.update.error.invalidUuid',
            'Invalid reference ID: fields such as bank account, income type, category, or service cannot be empty text. Clear the dropdown or pick a valid option from the list.'
          ),
          variant: 'destructive',
        });
        console.error('Error updating income transaction:', error);
        return;
      }
      if (
        code === '23505' ||
        /DUPLICATE KEY/i.test(msgUpper) ||
        /UNIQUE CONSTRAINT/i.test(msgUpper) ||
        /IDX_INCOME_TRANSACTIONS_ORG_TRANSACTION_REF/i.test(msgUpper)
      ) {
        toast({
          title: t('common.error', 'Error'),
          description: t(
            'incomes.update.error.duplicateRef',
            'This external transaction ID is already used by another income record in your organization.'
          ),
          variant: 'destructive',
        });
        console.error('Error updating income transaction:', error);
        return;
      }

      const detail = sanitizeUuidMessageForToast(aggregated);
      toast({
        title: t('common.error', 'Error'),
        description:
          detail.length > 0
            ? t('incomes.update.error.withDetail', 'Update failed: {{message}}', { message: detail })
            : t('incomes.update.error.generic', 'Failed to update income transaction'),
        variant: 'destructive',
      });
      console.error('Error updating income transaction:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) {
        throw new Error('No organization');
      }

      await deleteIncomeTransactionForOrg({
        supabase,
        organizationId,
        incomeTransactionId: id,
        updateBalance,
      });
    },
    onSuccess: async () => {
      await refetchIncomeModuleQueries(queryClient, organizationId);
      toast({
        title: t('common.success', 'Success'),
        description: t('incomes.delete.success', 'Income transaction deleted successfully'),
      });
    },
    onError: (error: Error & { message?: string; code?: string }) => {
      const raw = (error?.message || '').toUpperCase();
      const code = String(error?.code ?? '');
      const insufficient = raw.includes('INSUFFICIENT_DEST_TO_DELETE_TRANSFER');
      const fkBlocked =
        code === '23503' ||
        raw.includes('INCOME_ALLOCATIONS') ||
        (raw.includes('VIOLATES FOREIGN KEY') && raw.includes('INCOME'));
      toast({
        title: t('common.error', 'Error'),
        description: fkBlocked
          ? t(
              'incomes.delete.error.lockedByAllocation',
              'This income is allocated to an expense or debt payment. Delete or change that payment first, then try again.'
            )
          : insufficient
            ? t(
                'incomes.delete.error.insufficientDest',
                'Destination account book balance is too low to undo this transfer (funds may have been used).'
              )
            : t('incomes.delete.error.generic', 'Failed to delete income transaction'),
        variant: 'destructive',
      });
      console.error('Error deleting income transaction:', error);
    },
  });

  return {
    incomeTransactions,
    isLoading,
    isPending,
    error,
    refetch,
    createIncomeTransaction: createMutation.mutate,
    createIncomeTransactionAsync: createMutation.mutateAsync,
    updateIncomeTransaction: updateMutation.mutate,
    updateIncomeTransactionAsync: updateMutation.mutateAsync,
    deleteIncomeTransaction: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
