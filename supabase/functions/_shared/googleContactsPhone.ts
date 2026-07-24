/** Normalize phone to E.164; default country Indonesia (+62) only for local numbers. */

export function normalizePhoneToE164(
  raw: string | null | undefined,
  defaultCountryCode = "62",
): string | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) {
    digits = `+${digits.slice(2)}`;
  }

  if (digits.startsWith("+")) {
    const only = digits.slice(1).replace(/\D/g, "");
    if (only.length < 8 || only.length > 15) return null;
    return `+${only}`;
  }

  let local = digits.replace(/\D/g, "");
  if (!local) return null;

  const cc = defaultCountryCode.replace(/\D/g, "") || "62";

  // Already includes Indonesia country code (62…)
  if (local.startsWith(cc) && local.length >= 10 && local.length <= 15) {
    return `+${local}`;
  }

  // Local ID: leading 0 (08…) → strip then +62
  if (local.startsWith("0")) {
    local = local.slice(1);
    const e164 = `+${cc}${local}`;
    const only = e164.slice(1);
    if (only.length < 8 || only.length > 15) return null;
    return e164;
  }

  // Looks like international without + (e.g. 4477… UK, 1… US) — do not force +62
  if (local.length >= 11 && local.length <= 15 && !local.startsWith(cc)) {
    return `+${local}`;
  }

  // Short local mobile without 0 (e.g. 8788…) → assume default country
  const e164 = `+${cc}${local}`;
  const only = e164.slice(1);
  if (only.length < 8 || only.length > 15) return null;
  return e164;
}

/** Prefer fewer variants to avoid People API rate limits. */
export function phoneSearchVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };
  push(e164);
  push(digits);
  if (digits.startsWith("62") && digits.length > 3) {
    push(`0${digits.slice(2)}`);
  }
  return out;
}
