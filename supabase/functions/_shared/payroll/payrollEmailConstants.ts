export const PAYROLL_PAYSLIP_OFFICE_URL =
  "https://office.synckerja.com/profile/payslips";

export const PAYROLL_EMAIL_ORG_FALLBACK = "Synckerja Office";

function extractBareFromEmail(fromEmail: string): string {
  const trimmed = fromEmail.trim();
  const match = trimmed.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim();
  return trimmed;
}

export function resolvePayrollPayslipUrl(): string {
  const siteUrl = (
    Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? ""
  ).replace(/\/$/, "");
  return siteUrl ? `${siteUrl}/profile/payslips` : PAYROLL_PAYSLIP_OFFICE_URL;
}

export function formatResendFromDisplayName(
  organizationName: string,
  fromEmail: string,
): string {
  const bareEmail = extractBareFromEmail(fromEmail);
  const safe = organizationName
    .replace(/[<>"]/g, "")
    .trim()
    .slice(0, 80);
  const display = safe || PAYROLL_EMAIL_ORG_FALLBACK;
  return `${display} <${bareEmail}>`;
}

export function resolveOrganizationDisplayName(organizationName: string): string {
  const trimmed = organizationName.trim();
  return trimmed || PAYROLL_EMAIL_ORG_FALLBACK;
}
