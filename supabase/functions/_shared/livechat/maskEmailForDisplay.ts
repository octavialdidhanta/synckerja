/**
 * Masking alamat email untuk tampilan (display-only) di Edge Functions.
 * Contoh: oktavialdidhanta@gmail.com → o**************a@gmail.com
 */

const EMAIL_DISPLAY_RE =
  /[^\s@,;:<>()[\]{}"']+@[^\s@,;:<>()[\]{}"']+\.[^\s@,;:<>()[\]{}"']+/g;

function maskEmailLocalPart(local: string): string {
  const len = local.length;
  if (len <= 1) return local || "*";
  return `${local[0]}${"*".repeat(len - 2)}${local[len - 1]}`;
}

function maskSingleEmailForDisplay(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return email;
  return `${maskEmailLocalPart(email.slice(0, at))}${email.slice(at)}`;
}

export function maskEmailsForDisplay(
  text: string | null | undefined,
): string {
  if (text == null || text === "") return text ?? "";
  return text.replace(EMAIL_DISPLAY_RE, (match) => {
    const cleaned = match.replace(/[.,;:!?]+$/, "");
    const trailing = match.slice(cleaned.length);
    return `${maskSingleEmailForDisplay(cleaned)}${trailing}`;
  });
}
