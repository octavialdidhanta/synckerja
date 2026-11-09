export function rupiah(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rp${Math.round(Math.abs(value)).toLocaleString("id-ID")}`;
}

/** "+Rp1.200", "−Rp2.500", or "Rp0". */
export function signedRupiah(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  if (rounded === 0) return "Rp0";
  return `${rounded > 0 ? "+" : "−"}${rupiah(rounded)}`;
}

export function percent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function deltaDirection(value: number | null | undefined): "up" | "down" | "flat" {
  if (value == null || !Number.isFinite(value)) return "flat";
  const rounded = Math.round(value);
  if (rounded > 0) return "up";
  if (rounded < 0) return "down";
  return "flat";
}
