import { CheckCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

type PasswordRequirementGridProps = {
  password: string;
  className?: string;
};

export function PasswordRequirementGrid({ password, className }: PasswordRequirementGridProps) {
  const { t } = useTranslation();

  const rows = [
    { ok: password.length >= 8, label: t("auth.register.ruleLen") },
    { ok: /[0-9]/.test(password), label: t("auth.register.ruleNum") },
    { ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password), label: t("auth.register.ruleSpec") },
    { ok: /[A-Z]/.test(password), label: t("auth.register.ruleUp") },
    { ok: /[a-z]/.test(password), label: t("auth.register.ruleLow") },
  ];

  return (
    <ul
      className={`mt-1.5 grid grid-cols-1 gap-y-0.5 text-[10px] leading-tight min-[400px]:grid-cols-2 min-[400px]:gap-x-2 sm:text-xs ${className ?? ""}`}
      aria-live="polite"
    >
      {rows.map((row) => (
        <li
          key={row.label}
          className={`flex items-start gap-1 ${row.ok ? "text-[hsl(var(--brand-blue))]" : "text-slate-500"}`}
        >
          {row.ok ? (
            <CheckCircle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="mt-px h-3 w-3 shrink-0 opacity-70" aria-hidden />
          )}
          <span>{row.label}</span>
        </li>
      ))}
    </ul>
  );
}
