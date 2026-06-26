function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const hasText = (value?: string | null) => Boolean(value && String(value).trim());

function formatInterviewDate(dateValue?: string | null): string {
  if (!hasText(dateValue)) return "";
  const parsed = new Date(dateValue as string);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export type RecruitmentInterviewEmailInput = {
  applicantName: string;
  applicantEmail: string;
  positionTitle: string;
  companyName?: string;
  recruitmentToken?: string | null;
  interviewDate?: string | null;
  interviewTime?: string | null;
  interviewLocation?: string | null;
  interviewerName?: string | null;
  interviewNotes?: string | null;
  origin: string;
};

export function buildRecruitmentInterviewEmailText(
  details: RecruitmentInterviewEmailInput,
): string {
  const positionTitle = details.positionTitle || "the position";
  const companyLabel = details.companyName?.trim() || "our organization";
  const profileLink = details.recruitmentToken
    ? `${details.origin}/candidate/profile?token=${details.recruitmentToken}`
    : "";

  const formattedDate = formatInterviewDate(details.interviewDate);
  const formattedTime = details.interviewTime?.trim() || "";

  let emailBody = `INTERVIEW INVITATION
===================

Dear ${details.applicantName}

Thank you for your interest in the ${positionTitle} position with ${companyLabel}.

We have reviewed your application and would like to invite you for an interview to discuss your qualifications further.`;

  if (
    formattedDate ||
    formattedTime ||
    hasText(details.interviewLocation) ||
    hasText(details.interviewerName)
  ) {
    emailBody += `

Interview Details:`;

    if (formattedDate) {
      emailBody += `

  Date: ${formattedDate}`;
    }

    if (formattedTime) {
      emailBody += `
  Time: ${formattedTime}`;
    }

    if (hasText(details.interviewLocation)) {
      emailBody += `
  Location: ${details.interviewLocation?.trim()}`;
    }

    if (hasText(details.interviewerName)) {
      emailBody += `
  Interviewer: ${details.interviewerName?.trim()}`;
    }
  }

  if (hasText(details.interviewNotes)) {
    emailBody += `

Additional Notes:
${details.interviewNotes?.trim()}`;
  }

  if (profileLink) {
    emailBody += `

Profile Completion Required:

${profileLink}`;
  }

  emailBody += `



Best regards,
HR Recruitment Team
================== 
Please reply to confirm your availability`;

  return emailBody;
}

function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br>\n");
}

function formatResendFrom(companyName: string | undefined, fromEmail: string): string {
  const name = companyName?.trim() || "Synckerja HR";
  if (fromEmail.includes("<")) return fromEmail;
  return `${name} <${fromEmail}>`;
}

export async function sendRecruitmentInterviewEmailViaResend(
  details: RecruitmentInterviewEmailInput,
): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";

  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const to = details.applicantEmail.trim().toLowerCase();
  if (!to.includes("@")) {
    return { ok: false, error: "Valid recipient email is required" };
  }

  const positionTitle = details.positionTitle || "the position";
  const subject = `Interview Invitation - ${positionTitle}`;
  const bodyText = buildRecruitmentInterviewEmailText(details);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatResendFrom(details.companyName, fromEmail),
      to: [to],
      subject,
      text: bodyText,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;line-height:1.5;">
          ${plainTextToHtml(bodyText)}
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[send-recruitment-interview-email] Resend error", res.status, text);
    return { ok: false, error: text || "Resend request failed" };
  }

  return { ok: true };
}

export function isInterviewScheduleComplete(application: {
  interview_date?: string | null;
  interview_time?: string | null;
  interview_location?: string | null;
}): boolean {
  return (
    hasText(application.interview_date) &&
    hasText(application.interview_time) &&
    hasText(application.interview_location)
  );
}
