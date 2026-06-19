/** Bank name → Xendit disbursement code (Indonesia). Keep in sync with src/shared/lib/payroll/payrollBankCodes.ts */
export const PAYROLL_BANK_ENTRIES: Array<{
  label: string;
  xenditCode: string;
  aliases: string[];
}> = [
  { label: "BCA", xenditCode: "BCA", aliases: ["bca", "bank central asia", "bank bca"] },
  { label: "Mandiri", xenditCode: "MANDIRI", aliases: ["mandiri", "bank mandiri"] },
  { label: "BNI", xenditCode: "BNI", aliases: ["bni", "bank negara indonesia"] },
  { label: "BRI", xenditCode: "BRI", aliases: ["bri", "bank rakyat indonesia"] },
  { label: "Permata", xenditCode: "PERMATA", aliases: ["permata", "bank permata"] },
  { label: "CIMB Niaga", xenditCode: "CIMB", aliases: ["cimb", "cimb niaga"] },
  { label: "BJB", xenditCode: "BJB", aliases: ["bjb", "bank jabar", "bank bjb"] },
  { label: "BSI", xenditCode: "BSI", aliases: ["bsi", "bank syariah indonesia"] },
];

export function mapBankNameToCode(bankName: string): string {
  const key = bankName.trim().toLowerCase();
  for (const entry of PAYROLL_BANK_ENTRIES) {
    if (entry.aliases.some((alias) => key.includes(alias))) {
      return entry.xenditCode;
    }
  }
  return bankName.trim().toUpperCase().replace(/\s+/g, "_");
}

export function isKnownPayrollBank(bankName: string): boolean {
  const key = bankName.trim().toLowerCase();
  if (!key) return false;
  return PAYROLL_BANK_ENTRIES.some((entry) => entry.aliases.some((alias) => key.includes(alias)));
}
