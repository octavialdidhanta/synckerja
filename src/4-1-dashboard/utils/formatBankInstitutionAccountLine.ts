/**
 * Satu baris identitas rekening untuk UI ringkas, mis. "BCA : 8710178926".
 * Menggunakan `bank_name` (nama bank) dan `account_number`.
 */
export function formatBankInstitutionAccountLine(account: {
  bank_name?: string | null;
  account_number?: string | null;
}): string | null {
  const bank = account.bank_name?.trim();
  const num = account.account_number?.trim();
  if (bank && num) return `${bank} : ${num}`;
  if (num) return num;
  if (bank) return bank;
  return null;
}
