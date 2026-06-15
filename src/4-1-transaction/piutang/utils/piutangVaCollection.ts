/** Whether VA collection UI should be offered for this payment row. */
export function shouldOfferPiutangVaCollection(params: {
  transferVerificationStatus?: string | null;
  paymentMethod?: string | null;
  receiptUrl?: string | null;
}): boolean {
  const status = (params.transferVerificationStatus ?? 'unchecked').toLowerCase();
  if (status === 'approved') return false;

  const method = (params.paymentMethod ?? '').toLowerCase().replace(/-/g, '_');
  if (method === 'xendit_va') return false;

  const hasReceipt = Boolean((params.receiptUrl ?? '').trim());
  const isManualBank =
    method === 'bank_transfer' || method === 'transfer' || method === 'bank transfer';

  if (hasReceipt && isManualBank) return false;

  return true;
}

/** Manual bank transfer with receipt — show piutang verification UI only. */
export function isManualBankTransferPayment(params: {
  paymentMethod?: string | null;
  receiptUrl?: string | null;
}): boolean {
  const method = (params.paymentMethod ?? '').toLowerCase().replace(/-/g, '_');
  const isManualBank =
    method === 'bank_transfer' || method === 'transfer' || method === 'bank transfer';
  return isManualBank && Boolean((params.receiptUrl ?? '').trim());
}

export function isXenditVaPayment(paymentMethod?: string | null): boolean {
  return (paymentMethod ?? '').toLowerCase().replace(/-/g, '_') === 'xendit_va';
}
