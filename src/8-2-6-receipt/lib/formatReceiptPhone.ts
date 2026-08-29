export function formatReceiptRupiah(amount: number): string {
  const formatted = Math.round(amount).toLocaleString("id-ID");
  return `Rp. ${formatted}`;
}

export function nationalPhoneFromStored(phone: string | null | undefined): string {
  const raw = (phone ?? "").trim().replace(/[\s-]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+62")) return raw.slice(3);
  if (raw.startsWith("62") && raw.length > 8) return raw.slice(2);
  if (raw.startsWith("0")) return raw.slice(1);
  return raw;
}

export function storedPhoneFromNational(national: string): string | null {
  const digits = national.replace(/\D/g, "");
  if (!digits) return null;
  return `+62${digits}`;
}

export function formatReceiptPhoneDisplay(phone: string | null | undefined): string {
  const national = nationalPhoneFromStored(phone);
  if (!national) return "";
  return `+62 ${national}`;
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
