import { useTranslation } from "react-i18next";
import { NEW_PASSWORD_MIN } from "@/1-home/settings/hooks/useChangePasswordSettings";

type Props = {
  password: string;
};

export function PasswordStrengthIndicator({ password }: Props) {
  const { t } = useTranslation();

  const getStrength = () => {
    let score = 0;
    if (password.length >= NEW_PASSWORD_MIN) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const label =
    strength < 2
      ? t("settings.security.passwordStrength.weak")
      : strength < 4
        ? t("settings.security.passwordStrength.fair")
        : strength < 5
          ? t("settings.security.passwordStrength.good")
          : t("settings.security.passwordStrength.strong");

  const barClass =
    strength < 2
      ? "bg-destructive"
      : strength < 4
        ? "bg-amber-500"
        : strength < 5
          ? "bg-primary"
          : "bg-emerald-600";

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("settings.security.passwordStrength.label")}</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full transition-all ${barClass}`}
          style={{ width: `${(strength / 6) * 100}%` }}
        />
      </div>
    </div>
  );
}
