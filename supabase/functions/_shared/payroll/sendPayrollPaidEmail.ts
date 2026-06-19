function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import {
  formatResendFromDisplayName,
  resolveOrganizationDisplayName,
} from "./payrollEmailConstants.ts";

function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type SendPayrollPaidEmailInput = {
  email: string;
  fullName: string;
  organizationName: string;
  periodLabel: string;
  takeHomePay: number;
  bankName: string;
  accountLast4: string;
  payslipUrl: string;
  locale: "id" | "en";
};

export async function sendPayrollPaidEmail(
  input: SendPayrollPaidEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const isEn = input.locale === "en";
  const subject = isEn
    ? `Salary for ${input.periodLabel} has been transferred`
    : `Gaji ${input.periodLabel} telah ditransfer`;

  const greeting = isEn
    ? `Hi ${escapeHtml(input.fullName || "there")},`
    : `Halo ${escapeHtml(input.fullName || "karyawan")},`;

  const bodyLine = isEn
    ? `Your take-home pay of <strong>${escapeHtml(formatIdr(input.takeHomePay))}</strong> for <strong>${escapeHtml(input.periodLabel)}</strong> has been transferred to your bank account <strong>${escapeHtml(input.bankName)} •••${escapeHtml(input.accountLast4)}</strong>.`
    : `Take-home pay Anda sebesar <strong>${escapeHtml(formatIdr(input.takeHomePay))}</strong> untuk periode <strong>${escapeHtml(input.periodLabel)}</strong> telah ditransfer ke rekening <strong>${escapeHtml(input.bankName)} •••${escapeHtml(input.accountLast4)}</strong>.`;

  const orgDisplay = escapeHtml(resolveOrganizationDisplayName(input.organizationName));
  const ctaLabel = isEn
    ? `View payslip in ${orgDisplay}`
    : `Lihat slip gaji di ${orgDisplay}`;
  const footer = isEn
    ? "If you have questions, contact your HR or finance team."
    : "Jika ada pertanyaan, hubungi tim HR atau keuangan perusahaan Anda.";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatResendFromDisplayName(input.organizationName, fromEmail),
      to: [input.email.trim().toLowerCase()],
      subject,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
          <p>${greeting}</p>
          <p>${bodyLine}</p>
          <p style="margin:28px 0;">
            <a href="${escapeHtml(input.payslipUrl)}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
              ${ctaLabel}
            </a>
          </p>
          <p style="color:#64748b;font-size:13px;">${footer}</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend payroll paid email error", res.status, text);
    return { ok: false, error: text || "Resend request failed" };
  }

  return { ok: true };
}
