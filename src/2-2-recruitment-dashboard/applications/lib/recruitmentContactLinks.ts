import { format } from 'date-fns';

export type InterviewInvitationDetails = {
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
  origin?: string;
};

const hasText = (value?: string | null) => Boolean(value && String(value).trim());

export const isInterviewScheduleComplete = (details: {
  interviewDate?: string | null;
  interviewTime?: string | null;
  interviewLocation?: string | null;
}) =>
  hasText(details.interviewDate) &&
  hasText(details.interviewTime) &&
  hasText(details.interviewLocation);

export function formatInterviewDate(dateValue?: string | null): string {
  if (!hasText(dateValue)) return '';
  const parsed = new Date(dateValue as string);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'EEEE, MMMM dd, yyyy');
}

export function buildInterviewInvitationEmailBody(
  details: InterviewInvitationDetails,
): string {
  const positionTitle = details.positionTitle || 'the position';
  const companyLabel = details.companyName?.trim() || 'our organization';
  const origin = details.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const profileLink = details.recruitmentToken
    ? `${origin}/candidate/profile?token=${details.recruitmentToken}`
    : '';

  const formattedDate = formatInterviewDate(details.interviewDate);
  const formattedTime = details.interviewTime?.trim() || '';

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

export function buildInterviewInvitationMailto(
  details: InterviewInvitationDetails,
): string | null {
  const email = details.applicantEmail?.trim();
  if (!email) return null;

  const positionTitle = details.positionTitle || 'the position';
  const subject = `Interview Invitation - ${positionTitle}`;
  const body = buildInterviewInvitationEmailBody(details);

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Reliable mailto launch (window.open often blocked for mailto:). */
export function openMailtoLink(mailtoUrl: string): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const anchor = document.createElement('a');
    anchor.href = mailtoUrl;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } catch (error) {
    console.error('Failed to open mailto link:', error);
    return false;
  }
}

export function formatWhatsAppPhone(applicantPhone: string): string | null {
  const digits = applicantPhone.replace(/[^0-9]/g, '');
  if (!digits) return null;

  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return `62${digits}`;
}
