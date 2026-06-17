/** Product support contact (Help page). Legal/policy email remains in @/policy/contact. */
export const SUPPORT_EMAIL = "support@synckerja.com";

const DEFAULT_SUPPORT_SUBJECT = "Synckerja Support Request";

export function supportMailtoHref(subject = DEFAULT_SUPPORT_SUBJECT): string {
  const query = `subject=${encodeURIComponent(subject)}`;
  return `mailto:${SUPPORT_EMAIL}?${query}`;
}

/** Gmail web compose for users without a desktop mail client. */
export function supportGmailComposeHref(subject = DEFAULT_SUPPORT_SUBJECT): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: SUPPORT_EMAIL,
    su: subject,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
