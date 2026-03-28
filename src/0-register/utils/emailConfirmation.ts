import { supabase } from "@/shared/lib/supabaseClient";

/** Token row is created by DB trigger; RPC validates auth.users id+email (no open RLS on tokens). */
export async function fetchLatestVerificationTokenForUser(
  userId: string,
  email: string,
  maxAttempts = 40,
  delayMs = 250,
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase.rpc("get_latest_signup_verification_token", {
      p_user_id: userId,
      p_email: email.trim(),
    });
    if (error) {
      console.warn("get_latest_signup_verification_token", error);
    } else {
      const row = data as { ok?: boolean; token?: string };
      if (row?.ok && row.token) return row.token;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** If trigger row is not visible yet (or migration without trigger), create token via RPC in the same project. */
export async function ensureSignupVerificationToken(email: string, userId: string): Promise<string | null> {
  const fromTable = await fetchLatestVerificationTokenForUser(userId, email);
  if (fromTable) return fromTable;

  const { data, error } = await supabase.rpc("issue_new_verification_token", {
    p_email: email.trim(),
  });
  if (error) {
    console.warn("issue_new_verification_token after signup", error);
    return null;
  }
  const row = data as { ok?: boolean; token?: string };
  if (row?.ok && row.token) return row.token;
  return null;
}

export const sendConfirmationEmail = async (
  email: string,
  fullName: string,
  confirmationUrl: string,
  token: string,
  /** Prefer access_token from signUp/session so the gateway sees a stable JWT (avoids races with getSession). */
  accessToken?: string | null,
) => {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : confirmationUrl;

  const { data, error } = await supabase.functions.invoke("send-confirmation-email", {
    body: {
      email: email.trim(),
      fullName: fullName.trim(),
      confirmationUrl: baseUrl,
      token: token.trim(),
    },
    headers:
      accessToken && accessToken.length > 0
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
  });

  if (error) {
    throw new Error(error.message || "Failed to send confirmation email");
  }

  if (data && typeof data === "object" && "success" in data && !(data as { success: boolean }).success) {
    const err = (data as { error?: string }).error;
    throw new Error(err || "Failed to send confirmation email");
  }

  return data;
};
