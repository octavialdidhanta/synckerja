import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { ensureSignupVerificationToken, sendConfirmationEmail } from "@/0-register/utils/emailConfirmation";
import { ensureRegistrationProfile } from "@/0-register/utils/ensureRegistrationProfile";
import { validateEmailFormat, sanitizeEmail } from "@/0-register/utils/emailValidation";

export const useRegistration = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const navigate = useNavigate();

  const register = async (fullName: string, email: string, password: string, password2: string) => {
    setError(null);
    setEmailSuggestion(null);

    if (!fullName.trim()) {
      setError("Nama lengkap wajib diisi");
      return;
    }
    if (password !== password2) {
      setError("Konfirmasi password tidak sesuai");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);

    if (!hasNumber) {
      setError("Password harus mengandung angka");
      return;
    }
    if (!hasSpecialChar) {
      setError("Password harus mengandung karakter khusus");
      return;
    }
    if (!hasUpperCase) {
      setError("Password harus mengandung huruf besar");
      return;
    }
    if (!hasLowerCase) {
      setError("Password harus mengandung huruf kecil");
      return;
    }

    const sanitizedEmail = sanitizeEmail(email);
    const emailValidation = validateEmailFormat(sanitizedEmail);

    if (!emailValidation.isValid) {
      setError(emailValidation.error || "Email tidak valid");
      if (emailValidation.suggestion) {
        setEmailSuggestion(emailValidation.suggestion);
      }
      return;
    }

    setLoading(true);

    try {
      const { data: alreadyExists, error: rpcErr } = await supabase.rpc("email_exists", {
        p_email: sanitizedEmail,
      });

      if (rpcErr) {
        console.warn("email_exists rpc:", rpcErr);
      } else if (alreadyExists === true) {
        setError("Email sudah terdaftar. Silakan gunakan email lain atau login.");
        return;
      }

      sessionStorage.setItem("registrationInProgress", "true");
      sessionStorage.setItem("registrationFlow", "true");
      sessionStorage.setItem("fromRegistration", "true");
      sessionStorage.setItem("userEmail", sanitizedEmail);
      sessionStorage.setItem("userName", fullName.trim());

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error: signErr } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${origin}/email-verified`,
        },
      });

      if (signErr) {
        if (signErr.message?.toLowerCase().includes("already")) {
          toast({
            title: "Akun sudah terdaftar",
            description: "Silakan login dengan email ini.",
            variant: "destructive",
          });
          sessionStorage.removeItem("registrationInProgress");
          navigate("/login", { replace: true });
          return;
        }

        setError(signErr.message);
        toast({
          title: "Registrasi gagal",
          description: signErr.message,
          variant: "destructive",
        });
        sessionStorage.removeItem("registrationInProgress");
        sessionStorage.removeItem("registrationFlow");
        sessionStorage.removeItem("fromRegistration");
        sessionStorage.removeItem("userEmail");
        sessionStorage.removeItem("userName");
        return;
      }

      if (data.user) {
        sessionStorage.setItem("pendingUserId", data.user.id);
        sessionStorage.setItem("registrationFlow", "true");
        sessionStorage.setItem("fromRegistration", "true");
        sessionStorage.setItem("userEmail", sanitizedEmail);
        sessionStorage.setItem("userName", fullName.trim());

        const signupAccessToken = data.session?.access_token ?? null;
        if (data.session?.access_token && data.session.refresh_token) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          if (sessionErr) {
            console.warn("setSession after signUp:", sessionErr);
          }
        }

        const profileOk = await ensureRegistrationProfile(data.user.id, sanitizedEmail);
        if (!profileOk) {
          console.warn("Profile row may be missing: ensure_registration_profile failed or RPC not deployed.");
        }

        let emailDispatchOk = false;
        try {
          sessionStorage.removeItem("verifyEmailSentToast");
          sessionStorage.removeItem("verifyEmailSentOk");
          const token = await ensureSignupVerificationToken(sanitizedEmail, data.user.id);
          if (!token) {
            throw new Error(t("auth.register.tokenNotReady"));
          }
          await sendConfirmationEmail(sanitizedEmail, fullName.trim(), origin, token, signupAccessToken);
          sessionStorage.setItem("verifyEmailSentOk", "1");
          sessionStorage.setItem("verifyEmailSentToast", "1");
          emailDispatchOk = true;
          toast({
            title: "Registrasi berhasil",
            description: "Email konfirmasi telah dikirim. Periksa inbox Anda.",
          });
        } catch (emailError) {
          sessionStorage.removeItem("verifyEmailSentToast");
          sessionStorage.removeItem("verifyEmailSentOk");
          sessionStorage.removeItem("registrationFlow");
          sessionStorage.removeItem("fromRegistration");
          const errorMessage = emailError instanceof Error ? emailError.message : "Unknown email error";
          if (
            errorMessage.includes("550") ||
            errorMessage.includes("bounce") ||
            errorMessage.includes("does not exist")
          ) {
            sessionStorage.setItem(
              "emailError",
              "Email yang Anda masukkan tidak valid atau tidak ada. Silakan periksa kembali alamat email Anda.",
            );
          } else {
            sessionStorage.setItem("emailError", errorMessage);
          }
          toast({
            title: "Peringatan email",
            description: "Akun dibuat, namun pengiriman email konfirmasi bermasalah.",
            variant: "destructive",
          });
        } finally {
          sessionStorage.removeItem("registrationInProgress");
        }

        if (emailDispatchOk) {
          navigate("/verify-email", { replace: true });
        } else {
          navigate("/register", { replace: true });
        }

        setTimeout(async () => {
          try {
            await supabase.auth.signOut({ scope: "global" });
            Object.keys(localStorage).forEach((key) => {
              if (
                key.startsWith("supabase.auth.token") ||
                (key.startsWith("sb-") && key.includes("auth-token"))
              ) {
                localStorage.removeItem(key);
              }
            });
          } catch {
            Object.keys(localStorage).forEach((key) => {
              if (
                key.startsWith("supabase.auth.token") ||
                (key.startsWith("sb-") && key.includes("auth-token"))
              ) {
                localStorage.removeItem(key);
              }
            });
          }
        }, 100);

        return;
      }

      setError("Terjadi kesalahan saat mendaftar. Silakan coba lagi.");
    } catch (err) {
      console.error("Registration error:", err);
      setError("Terjadi kesalahan saat mendaftar. Silakan coba lagi.");
      toast({
        title: "Registrasi gagal",
        description: "Terjadi kesalahan saat mendaftar.",
        variant: "destructive",
      });
      sessionStorage.removeItem("registrationInProgress");
      sessionStorage.removeItem("registrationFlow");
      sessionStorage.removeItem("fromRegistration");
      sessionStorage.removeItem("userEmail");
      sessionStorage.removeItem("userName");
    } finally {
      setLoading(false);
    }
  };

  const acceptEmailSuggestion = (suggestedEmail: string) => {
    setEmailSuggestion(null);
    setError(null);
    return suggestedEmail;
  };

  return {
    register,
    loading,
    error,
    emailSuggestion,
    acceptEmailSuggestion,
  };
};
