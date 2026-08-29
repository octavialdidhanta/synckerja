import { mapBankNameToXenditCode } from "@/xendit/lib/bankCodes";

/** Map display bank name to Xendit disbursement bank code when known. */
export function mapBankNameToGatewayCode(bankName: string): string | null {
  const name = bankName.trim();
  if (!name) return null;
  const code = mapBankNameToXenditCode(name);
  // mapBankNameToXenditCode falls back to UPPER_SNAKE of full name — only keep short known codes
  const known = new Set([
    "BCA",
    "MANDIRI",
    "BNI",
    "BRI",
    "PERMATA",
    "BJB",
    "BSI",
    "CIMB",
    "SAHABAT_SAMPOERNA",
  ]);
  return known.has(code) ? code : null;
}

export function buildBankAccountDisplayName(args: {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}): string {
  const bank = args.bankName.trim() || "Bank";
  const number = args.accountNumber.trim();
  const holder = args.accountHolder.trim();
  if (number) return `${bank} · ${number}`;
  if (holder) return `${bank} · ${holder}`;
  return bank;
}
