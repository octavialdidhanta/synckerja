import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';

const BANK_ACCOUNT_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDebtPaymentBankAccountId(value: string | undefined | null): boolean {
  return typeof value === 'string' && BANK_ACCOUNT_UUID_RE.test(value.trim());
}

/** Payload from DebtPaymentModal → submitDebtPayment / parent handlers. */
export type DebtPaymentModalSubmitPayload = {
  debtId: string;
  paymentAmount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  transactionReference?: string;
  receiptFile?: File;
  /** Optional link to income on the same bank account (`payment_method`). */
  incomeAllocation?: { income_transaction_id: string; amount: number };
};

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
  const byName =
    name.endsWith('.jpeg') || name.endsWith('.jpg')
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
            : rawType || 'application/octet-stream';

  return { extension: byName, mimeType: mimeByExt };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * After a debt_payment row is committed: bump paid_amount, restore credit-line (non–Pinjaman Online),
 * and for Pinjaman Online call DB recalc (expense sum + paid_amount → remaining / available).
 */
async function syncDebtRowAfterPayment(params: {
  organizationId: string;
  debtId: string;
  paymentAmount: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId, debtId, paymentAmount } = params;
  const amt = roundMoney(Number(paymentAmount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, message: 'Invalid payment amount for debt sync' };
  }

  const { data: debt, error: fetchErr } = await supabase
    .from('debts')
    .select(
      'id, organization_id, debt_type, limit_amount, available_limit, debt_amount, paid_amount, remaining_debt',
    )
    .eq('id', debtId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchErr || !debt) {
    console.error('syncDebtRowAfterPayment fetch debt:', fetchErr);
    return { ok: false, message: fetchErr?.message ?? 'Debt not found' };
  }

  const prevPaid = roundMoney(Number(debt.paid_amount ?? 0));
  const newPaid = roundMoney(prevPaid + amt);
  const nowIso = new Date().toISOString();

  if (debt.debt_type === 'Pinjaman Online') {
    const { error: upErr } = await supabase
      .from('debts')
      .update({
        paid_amount: newPaid,
        updated_at: nowIso,
      })
      .eq('id', debtId)
      .eq('organization_id', organizationId);

    if (upErr) {
      console.error('syncDebtRowAfterPayment update paid (online):', upErr);
      return { ok: false, message: upErr.message };
    }

    const { error: rpcErr } = await supabase.rpc('recalculate_pinjaman_online_debt_amount', {
      p_debt_id: debtId,
    });
    if (rpcErr) {
      console.error('syncDebtRowAfterPayment recalculate_pinjaman_online:', rpcErr);
      return { ok: false, message: rpcErr.message };
    }
    return { ok: true };
  }

  const lim = roundMoney(Number(debt.limit_amount ?? 0));
  const debtAmt = roundMoney(Number(debt.debt_amount ?? 0));
  const currentAvail = debt.available_limit != null ? roundMoney(Number(debt.available_limit)) : lim;
  const newAvail = lim > 0 ? Math.min(lim, roundMoney(currentAvail + amt)) : roundMoney(currentAvail + amt);
  const remaining = Math.max(0, roundMoney(debtAmt - newPaid));

  const { error: upErr } = await supabase
    .from('debts')
    .update({
      paid_amount: newPaid,
      available_limit: newAvail,
      remaining_debt: remaining,
      updated_at: nowIso,
    })
    .eq('id', debtId)
    .eq('organization_id', organizationId);

  if (upErr) {
    console.error('syncDebtRowAfterPayment update debt:', upErr);
    return { ok: false, message: upErr.message };
  }

  return { ok: true };
}

/** Reverse {@link syncDebtRowAfterPayment} when a debt_payment row is removed (e.g. history delete). */
export async function reverseDebtRowAfterPaymentRemoved(params: {
  organizationId: string;
  debtId: string;
  paymentAmount: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId, debtId, paymentAmount } = params;
  const amt = roundMoney(Number(paymentAmount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, message: 'Invalid payment amount for debt reversal' };
  }

  const { data: debt, error: fetchErr } = await supabase
    .from('debts')
    .select(
      'id, organization_id, debt_type, limit_amount, available_limit, debt_amount, paid_amount, remaining_debt',
    )
    .eq('id', debtId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchErr || !debt) {
    console.error('reverseDebtRowAfterPaymentRemoved fetch debt:', fetchErr);
    return { ok: false, message: fetchErr?.message ?? 'Debt not found' };
  }

  const prevPaid = roundMoney(Number(debt.paid_amount ?? 0));
  const newPaid = Math.max(0, roundMoney(prevPaid - amt));
  const nowIso = new Date().toISOString();

  if (debt.debt_type === 'Pinjaman Online') {
    const { error: upErr } = await supabase
      .from('debts')
      .update({
        paid_amount: newPaid,
        updated_at: nowIso,
      })
      .eq('id', debtId)
      .eq('organization_id', organizationId);

    if (upErr) {
      console.error('reverseDebtRowAfterPaymentRemoved update paid (online):', upErr);
      return { ok: false, message: upErr.message };
    }

    const { error: rpcErr } = await supabase.rpc('recalculate_pinjaman_online_debt_amount', {
      p_debt_id: debtId,
    });
    if (rpcErr) {
      console.error('reverseDebtRowAfterPaymentRemoved recalculate_pinjaman_online:', rpcErr);
      return { ok: false, message: rpcErr.message };
    }
    return { ok: true };
  }

  const lim = roundMoney(Number(debt.limit_amount ?? 0));
  const debtAmt = roundMoney(Number(debt.debt_amount ?? 0));
  const currentAvail =
    debt.available_limit != null ? roundMoney(Number(debt.available_limit)) : lim;
  const newAvail = Math.max(0, roundMoney(currentAvail - amt));
  const remaining = Math.max(0, roundMoney(debtAmt - newPaid));

  const { error: upErr } = await supabase
    .from('debts')
    .update({
      paid_amount: newPaid,
      available_limit: newAvail,
      remaining_debt: remaining,
      updated_at: nowIso,
    })
    .eq('id', debtId)
    .eq('organization_id', organizationId);

  if (upErr) {
    console.error('reverseDebtRowAfterPaymentRemoved update debt:', upErr);
    return { ok: false, message: upErr.message };
  }

  return { ok: true };
}

async function uploadDebtPaymentReceipt(
  organizationId: string,
  file: File
): Promise<{ path: string; fileName: string; size: number; mimeType: string } | null> {
  const { extension, mimeType } = normalizeReceiptMetadata(file);
  const storageName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extension}`;
  const filePath = `${organizationId}/${storageName}`;
  const { error } = await supabase.storage.from('debt-payment-receipts').upload(filePath, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    console.error('debt payment receipt upload:', error);
    return null;
  }
  return { path: filePath, fileName: file.name, size: file.size, mimeType };
}

export interface SubmitDebtPaymentParams {
  organizationId: string;
  userId: string;
  debtId: string;
  paymentAmount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string | null;
  transactionReference?: string | null;
  receiptFile?: File | null;
  debtDisplayName: string;
  updateBalance: (
    bankAccountId: string,
    amount: number,
    transactionType: 'expense',
    transactionId: string | undefined,
    description: string | undefined
  ) => Promise<void>;
  /** e.g. refetchDebts */
  onAfterSuccess?: () => Promise<void>;
  income_allocation?: { income_transaction_id: string; amount: number } | null;
  messages: {
    duplicateTransactionRef: string;
    receiptUploadFailed: string;
    paymentInsertFailed: string;
    bankAccountRequired: string;
    rollbackFailed: string;
    allocationLinkFailed: string;
  };
}

/**
 * Insert debt_payments row, optional receipt upload, bank balance update.
 * Requires a valid bank account UUID; rolls back the payment row if balance update fails.
 */
export async function submitDebtPayment(params: SubmitDebtPaymentParams): Promise<boolean> {
  const {
    organizationId,
    userId,
    debtId,
    paymentAmount,
    paymentDate,
    paymentMethod,
    notes,
    transactionReference,
    receiptFile,
    debtDisplayName,
    updateBalance,
    onAfterSuccess,
    income_allocation,
    messages,
  } = params;

  if (!isValidDebtPaymentBankAccountId(paymentMethod)) {
    toast.error(messages.bankAccountRequired);
    return false;
  }

  const bankAccountId = paymentMethod.trim();

  let receipt_file_path: string | null = null;
  let receipt_file_name: string | null = null;
  let receipt_file_size: number | null = null;
  let receipt_mime_type: string | null = null;

  if (receiptFile) {
    const uploaded = await uploadDebtPaymentReceipt(organizationId, receiptFile);
    if (!uploaded) {
      toast.error(messages.receiptUploadFailed);
      return false;
    }
    receipt_file_path = uploaded.path;
    receipt_file_name = uploaded.fileName;
    receipt_file_size = uploaded.size;
    receipt_mime_type = uploaded.mimeType;
  }

  const refTrimmed = transactionReference?.trim() ?? null;
  const refForDb = refTrimmed && refTrimmed.length > 0 ? refTrimmed : null;

  const { data: inserted, error: paymentError } = await supabase
    .from('debt_payments')
    .insert({
      organization_id: organizationId,
      debt_id: debtId,
      created_by: userId,
      payment_amount: paymentAmount,
      payment_date: paymentDate,
      payment_method: bankAccountId,
      notes: notes?.trim() ? notes.trim() : null,
      transaction_reference: refForDb,
      receipt_file_path,
      receipt_file_name,
      receipt_file_size,
      receipt_mime_type,
    })
    .select('id')
    .single();

  if (paymentError || !inserted?.id) {
    const code = (paymentError as { code?: string } | undefined)?.code;
    const msg = String((paymentError as { message?: string } | undefined)?.message ?? '');
    if (
      code === '23505' ||
      /duplicate key/i.test(msg) ||
      /unique constraint/i.test(msg) ||
      /idx_debt_payments_org_transaction_ref/i.test(msg)
    ) {
      toast.error(messages.duplicateTransactionRef);
      return false;
    }
    console.error('debt_payments insert:', paymentError);
    toast.error(messages.paymentInsertFailed);
    return false;
  }

  const paymentRowId = inserted.id as string;

  try {
    await updateBalance(
      bankAccountId,
      -paymentAmount,
      'expense',
      paymentRowId,
      `Debt Payment: ${debtDisplayName}`
    );
  } catch (e) {
    console.error('updateBalance after debt payment:', e);
    const { error: deleteError } = await supabase.from('debt_payments').delete().eq('id', paymentRowId);
    if (deleteError) {
      console.error('debt_payments rollback after failed balance:', deleteError);
      toast.error(messages.rollbackFailed);
      return false;
    }
    toast.error(
      typeof e === 'object' && e !== null && 'message' in e ? String((e as Error).message) : messages.paymentInsertFailed
    );
    return false;
  }

  const alloc = income_allocation;
  if (alloc?.income_transaction_id && alloc.amount > 0) {
    const { error: allocError } = await supabase.from('income_allocations').insert({
      organization_id: organizationId,
      income_transaction_id: alloc.income_transaction_id,
      amount: alloc.amount,
      debt_payment_id: paymentRowId,
      created_by: userId,
    });
    if (allocError) {
      console.error('income_allocations insert after debt payment:', allocError);
      try {
        await updateBalance(
          bankAccountId,
          paymentAmount,
          'manual_adjustment',
          debtId,
          `Rollback debt payment: ${debtDisplayName}`
        );
      } catch (revErr) {
        console.error('rollback balance after allocation failure:', revErr);
        toast.error(messages.rollbackFailed);
        return false;
      }
      const { error: delPayErr } = await supabase.from('debt_payments').delete().eq('id', paymentRowId);
      if (delPayErr) {
        console.error('debt_payments rollback after allocation failure:', delPayErr);
        toast.error(messages.rollbackFailed);
        return false;
      }
      toast.error(messages.allocationLinkFailed);
      return false;
    }
  }

  const sync = await syncDebtRowAfterPayment({
    organizationId,
    debtId,
    paymentAmount,
  });
  if (!sync.ok) {
    console.error('syncDebtRowAfterPayment failed after payment recorded:', sync.message);
    toast.error(messages.paymentInsertFailed);
    return false;
  }

  if (onAfterSuccess) {
    await onAfterSuccess();
  }

  return true;
}
