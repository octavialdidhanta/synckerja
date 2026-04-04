/** Official contact for privacy and account deletion (replaces /contact-us until that page exists). */
export const POLICY_CONTACT_EMAIL = "business@vialdi.id";

/** Canonical app origin for legal / Meta policy links. Set `VITE_APP_URL` to override (e.g. staging). */
export function policyBaseUrl(): string {
  const env = (import.meta.env.VITE_APP_URL as string | undefined)?.trim().replace(/\/$/, "");
  if (env) return env;
  return "https://office.synckerja.com";
}

export function policyContactMailtoHref(): string {
  return `mailto:${POLICY_CONTACT_EMAIL}`;
}
