/**
 * Masking alamat email untuk TAMPILAN percakapan livechat (display-only).
 *
 * Contoh: oktavialdidhanta@gmail.com → o**************a@gmail.com
 * (huruf pertama & terakhir local-part + domain utuh; tengah diganti *).
 *
 * Teks asli tetap dikirim ke customer dan tetap tersimpan di DB
 * (agar auto-fill Client Profile berjalan).
 */

const EMAIL_DISPLAY_RE =
  /[^\s@,;:<>()[\]{}"']+@[^\s@,;:<>()[\]{}"']+\.[^\s@,;:<>()[\]{}"']+/g;

/** Mask local-part: keep first & last char, replace middle with *. */
export function maskEmailLocalPart(local: string): string {
  const len = local.length;
  if (len <= 1) return local || "*";
  return `${local[0]}${"*".repeat(len - 2)}${local[len - 1]}`;
}

export function maskSingleEmailForDisplay(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at); // includes @
  return `${maskEmailLocalPart(local)}${domain}`;
}

export function maskEmailsForDisplay(
  text: string | null | undefined,
): string | null | undefined {
  if (text == null || text === "") return text;
  return text.replace(EMAIL_DISPLAY_RE, (match) => {
    const cleaned = match.replace(/[.,;:!?]+$/, "");
    const trailing = match.slice(cleaned.length);
    return `${maskSingleEmailForDisplay(cleaned)}${trailing}`;
  });
}
