import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';

export type SendRecruitmentInterviewEmailResult = {
  success: boolean;
  error?: string;
};

export async function sendRecruitmentInterviewEmail(
  applicationId: string,
): Promise<SendRecruitmentInterviewEmailResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-recruitment-interview-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ applicationId }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };

  if (!res.ok || !json.success) {
    return {
      success: false,
      error: typeof json.error === 'string' ? json.error : 'Failed to send email',
    };
  }

  return { success: true };
}
