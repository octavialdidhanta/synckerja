import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { mapOperationalEmailRpcError } from "@/8-2-4-email-notifications/lib/validateRecipientEmail";
import { OPERATIONAL_EMAIL_RPC_ERRORS } from "@/8-2-4-email-notifications/types";

type VerifyState = "loading" | "success" | "error";

export default function VerifyOperationalEmailPage() {
  const { t } = useAppTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        setState("error");
        setMessage(
          t(
            "settings.emailNotifications.verify.missingToken",
            "Verification link is invalid or incomplete.",
          ),
        );
        return;
      }

      try {
        const { error } = await supabase.rpc("verify_operational_email_recipient", {
          p_token: token,
        });
        if (error) throw error;
        if (cancelled) return;
        setState("success");
        setMessage(
          t(
            "settings.emailNotifications.verify.success",
            "Your email has been verified. You will now receive operational notifications.",
          ),
        );
      } catch (error) {
        if (cancelled) return;
        const raw = error instanceof Error ? error.message : String(error ?? "");
        const code = mapOperationalEmailRpcError(raw);
        const key =
          code && code in OPERATIONAL_EMAIL_RPC_ERRORS
            ? OPERATIONAL_EMAIL_RPC_ERRORS[code as keyof typeof OPERATIONAL_EMAIL_RPC_ERRORS]
            : null;
        setState("error");
        setMessage(key ? t(key, raw) : raw);
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const Icon =
    state === "loading" ? Loader2 : state === "success" ? CheckCircle2 : XCircle;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <Icon
          className={`mx-auto mb-4 h-12 w-12 ${
            state === "loading"
              ? "animate-spin text-muted-foreground"
              : state === "success"
                ? "text-emerald-600"
                : "text-destructive"
          }`}
          aria-hidden
        />
        <h1 className="mb-2 text-lg font-semibold text-foreground">
          {state === "loading"
            ? t("settings.emailNotifications.verify.loadingTitle", "Verifying email…")
            : state === "success"
              ? t("settings.emailNotifications.verify.successTitle", "Email verified")
              : t("settings.emailNotifications.verify.errorTitle", "Verification failed")}
        </h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
