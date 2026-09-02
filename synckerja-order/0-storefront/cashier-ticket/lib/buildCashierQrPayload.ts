const PREFIX = "SYNK:";

export function buildCashierQrPayload(claimToken: string): string {
  return `${PREFIX}${claimToken.trim().toUpperCase()}`;
}

export function parseCashierQrPayload(raw: string): string | null {
  const text = raw.trim().toUpperCase();
  if (!text.startsWith(PREFIX)) return null;
  const token = text.slice(PREFIX.length).trim();
  return token.length >= 8 ? token : null;
}
