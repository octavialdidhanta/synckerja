/**
 * Valid email for identity / typo targeting.
 * Mirrors normalizeCustomerEmail + glued-TLD reject from isValidPosReceiptEmail.
 */
export function isValidIdentityEmail(email: string | null | undefined): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/.test(normalized)) return false;
  const domain = normalized.slice(normalized.indexOf("@") + 1);
  if (/(?:^|\.)(com|net|org|edu|gov|co|io|id|me|app|dev)[a-z]{2,}$/.test(domain)) {
    return false;
  }
  return true;
}

/** Non-empty email that fails identity validation (typo / invalid). */
export function isTypoEmailCandidate(email: string | null | undefined): boolean {
  const raw = String(email ?? "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return false;
  return !isValidIdentityEmail(raw);
}

export function splitEmailLocalDomain(
  email: string,
): { local: string; domain: string } | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return {
    local: normalized.slice(0, at),
    domain: normalized.slice(at + 1),
  };
}

/**
 * True when invalidDomain looks like validDomain with glued extra letters
 * on the last label (e.g. gmail.comsss vs gmail.com).
 */
export function isTypoDomainOf(validDomain: string, invalidDomain: string): boolean {
  const v = validDomain.trim().toLowerCase();
  const inv = invalidDomain.trim().toLowerCase();
  if (!v || !inv || v === inv) return false;
  if (inv === v) return false;
  if (inv.startsWith(v) && /^[a-z]{2,}$/.test(inv.slice(v.length))) return true;
  // last label: com -> comsss
  const vParts = v.split(".");
  const invParts = inv.split(".");
  if (vParts.length !== invParts.length) return false;
  for (let i = 0; i < vParts.length - 1; i++) {
    if (vParts[i] !== invParts[i]) return false;
  }
  const vLast = vParts[vParts.length - 1] ?? "";
  const invLast = invParts[invParts.length - 1] ?? "";
  return invLast.startsWith(vLast) && /^[a-z]{2,}$/.test(invLast.slice(vLast.length));
}
