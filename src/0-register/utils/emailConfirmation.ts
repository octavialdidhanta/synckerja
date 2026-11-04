import { supabase } from "@/shared/lib/supabaseClient";

async function edgeErrorMessage(data: unknown, error: unknown): Promise<string> {
  if (data && typeof data === "object" && "error" in data) {
    const value = (data as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : undefined;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) return body.error.trim();
    } catch {
      // The body was already consumed or was not JSON.
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return "";
}

export const sendConfirmationEmail = async (
  email: string,
  fullName: string,
  confirmationUrl: string,
  /** Prefer access_token from signUp/session so the gateway sees a stable JWT (avoids races with getSession). */
  accessToken?: string | null,
) => {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : confirmationUrl;

  const { data, error } = await supabase.functions.invoke("send-confirmation-email", {
    body: {
      email: email.trim(),
      fullName: fullName.trim(),
      confirmationUrl: baseUrl,
    },
    headers:
      accessToken && accessToken.length > 0
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
  });

  if (error) {
    const message = await edgeErrorMessage(data, error);
    throw new Error(message || "Failed to send confirmation email");
  }

  if (data && typeof data === "object" && "success" in data && !(data as { success: boolean }).success) {
    const err = (data as { error?: string }).error;
    throw new Error(err || "Failed to send confirmation email");
  }

  return data;
};
