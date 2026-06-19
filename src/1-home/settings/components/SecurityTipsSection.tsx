import { useTranslation } from "react-i18next";
import { CheckCircle, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export const SECURITY_TIP_KEYS = [
  "settings.security.tips.strongPassword",
  "settings.security.tips.complexity",
  "settings.security.tips.noPersonalInfo",
  "settings.security.tips.changeRegularly",
  "settings.security.tips.twoFactor",
] as const;

type Props = {
  className?: string;
  /** `card` — desktop Card wrapper; `plain` — list only for mobile sections */
  variant?: "card" | "plain";
};

export function SecurityTipsSection({ className, variant = "card" }: Props) {
  const { t } = useTranslation();

  const list = (
    <ul className={cn("space-y-3 text-sm text-muted-foreground", variant === "plain" && className)}>
      {SECURITY_TIP_KEYS.map((key) => (
        <li key={key} className="flex items-start gap-2">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );

  if (variant === "plain") {
    return (
      <section className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t("settings.security.tips.title")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.security.tips.description")}</p>
        {list}
      </section>
    );
  }

  return (
    <Card className={cn("border-border shadow-sm", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>{t("settings.security.tips.title")}</CardTitle>
        </div>
        <CardDescription>{t("settings.security.tips.description")}</CardDescription>
      </CardHeader>
      <CardContent>{list}</CardContent>
    </Card>
  );
}
