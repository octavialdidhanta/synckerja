export const XENDIT_DISBURSEMENT_BANKS = [
  { code: "BCA", label: "BCA" },
  { code: "MANDIRI", label: "Bank Mandiri" },
  { code: "BNI", label: "BNI" },
  { code: "BRI", label: "BRI" },
  { code: "PERMATA", label: "Permata" },
  { code: "BJB", label: "BJB" },
  { code: "BSI", label: "BSI" },
  { code: "CIMB", label: "CIMB Niaga" },
  { code: "SAHABAT_SAMPOERNA", label: "Bank Sahabat Sampoerna" },
] as const;

const BANK_NAME_TO_CODE: Record<string, string> = {
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

export function mapBankNameToXenditCode(bankName: string): string {
  const key = bankName.trim().toLowerCase();
  for (const [fragment, code] of Object.entries(BANK_NAME_TO_CODE)) {
    if (key.includes(fragment)) return code;
  }
  return bankName.trim().toUpperCase().replace(/\s+/g, "_");
}

export function isValidEmailAddress(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  if (normalized.endsWith(".local")) return false;
  return true;
}
