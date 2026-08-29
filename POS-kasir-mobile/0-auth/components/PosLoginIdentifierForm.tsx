import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { POS_AUTH_PATHS } from "../lib/posAuthPaths";
import { stashPosLoginEmail } from "../lib/posLoginEmailStorage";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function PosLoginIdentifierForm() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError(t("posAuth.errors.invalidEmail", "Enter a valid email address."));
      return;
    }
    setError(null);
    stashPosLoginEmail(trimmed);
    navigate(POS_AUTH_PATHS.loginPassword, { state: { email: trimmed } });
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-5">
      <SynckerjaBrandMark size="md" />
      <p className="text-center text-sm text-muted-foreground">
        {t("posAuth.login.subtitle", "Sign in with email")}
      </p>

      <Input
        type="email"
        autoComplete="email"
        inputMode="email"
        autoFocus
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError(null);
        }}
        placeholder={t("posAuth.login.emailPlaceholder", "Email")}
        className="h-12 w-full rounded-lg border-border bg-background text-base"
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}

      <Button
        type="submit"
        className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t("posAuth.login.next", "Next")}
      </Button>

      <Link to={POS_AUTH_PATHS.welcome} className="text-sm font-medium text-primary hover:underline">
        {t("posAuth.login.backToWelcome", "Back")}
      </Link>
    </form>
  );
}
