/** Col "Transaction ID": external ref if set, else shortened DB UUID (full id in title). */
export function getIncomeTransactionIdDisplay(transaction: {
  id: string;
  transaction_reference?: string | null;
}): { display: string; title: string } {
  const ref = transaction.transaction_reference?.trim();
  if (ref) return { display: ref, title: ref };
  return {
    display: `${transaction.id.slice(0, 8)}…`,
    title: transaction.id,
  };
}
