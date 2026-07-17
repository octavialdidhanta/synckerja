export type ParsedContact =
  | { kind: "phone"; normalized: string; raw: string }
  | { kind: "email"; normalized: string; raw: string }
  | { kind: "invalid" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Indonesia-friendly WA digit normalization (mirrors frontend normalizeWaPhoneKey). */
export function normalizeWaPhoneDigits(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0") && d.length >= 10) d = `62${d.slice(1)}`;
  if (!d.startsWith("62") && d.startsWith("8") && d.length >= 9 && d.length <= 12) d = `62${d}`;
  if (d.length < 8 || d.length > 18) return null;
  return d;
}

function extractEmailCandidate(text: string): string | null {
  const match = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  if (!match) return null;
  const email = match[0].trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

function extractPhoneCandidate(text: string): string | null {
  const digitRuns = text.match(/(?:\+?\d[\d\s().-]{6,}\d|\d{8,18})/g);
  if (!digitRuns?.length) return null;
  for (const run of digitRuns) {
    const normalized = normalizeWaPhoneDigits(run);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Parse a single inbound DM for phone or email.
 * If both appear, prefer phone (WA priority per product spec).
 */
export function parseContactReply(messageBody: string): ParsedContact {
  const text = messageBody.trim();
  if (!text) return { kind: "invalid" };

  const phone = extractPhoneCandidate(text);
  if (phone) {
    return { kind: "phone", normalized: phone, raw: text };
  }

  const email = extractEmailCandidate(text);
  if (email) {
    return { kind: "email", normalized: email, raw: text };
  }

  return { kind: "invalid" };
}
