const BANK_NAME_TO_ILUMA_CODE: Record<string, string> = {
  bca: "BCA",
  mandiri: "MANDIRI",
  bni: "BNI",
  bri: "BRI",
  permata: "PERMATA",
  cimb: "CIMB",
  bjb: "BJB",
  bsi: "BSI",
  sampoerna: "SAHABAT_SAMPOERNA",
};

export function mapToIlumaBankCode(bankCodeOrName: string): string {
  const raw = bankCodeOrName.trim();
  if (!raw) return "";
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (/^[A-Z0-9_]+$/.test(upper) && upper.length <= 32) return upper;
  const key = raw.toLowerCase();
  for (const [fragment, code] of Object.entries(BANK_NAME_TO_ILUMA_CODE)) {
    if (key.includes(fragment)) return code;
  }
  return upper;
}

export function normalizeBankAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/[^\d]/g, "");
}

export function normalizeAccountHolder(holder: string): string {
  return holder.trim().replace(/\s+/g, " ").toUpperCase();
}
