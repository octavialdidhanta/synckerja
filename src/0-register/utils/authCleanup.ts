import { supabase } from "@/shared/lib/supabaseClient";

export const cleanupAuthState = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
      localStorage.removeItem(key);
    }
  });
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
      sessionStorage.removeItem(key);
    }
  });
  sessionStorage.removeItem("registrationInProgress");
  sessionStorage.removeItem("registrationFlow");
  sessionStorage.removeItem("fromRegistration");
  sessionStorage.removeItem("userEmail");
  sessionStorage.removeItem("userName");
  sessionStorage.removeItem("pendingUserId");
  sessionStorage.removeItem("emailError");
  sessionStorage.removeItem("verifyEmailSentOk");
  sessionStorage.removeItem("verifyEmailSentToast");
  localStorage.removeItem("pendingEmailVerification");
};

export type AuthResetReason = "session_expired" | "stale" | undefined;

export const forceAuthReset = async (reason?: AuthResetReason) => {
  try {
    cleanupAuthState();
    await Promise.allSettled([
      supabase.auth.signOut({ scope: "global" }),
      supabase.auth.signOut({ scope: "local" }),
    ]);
  } catch {
    /* ignore */
  }
  const loginUrl = reason === "session_expired" ? "/login?reason=session_expired" : "/login";
  const onLogin =
    typeof window !== "undefined" &&
    (window.location.pathname === "/login" || window.location.pathname === "/login/");
  if (!onLogin && typeof window !== "undefined") {
    window.location.href = loginUrl;
  }
};
