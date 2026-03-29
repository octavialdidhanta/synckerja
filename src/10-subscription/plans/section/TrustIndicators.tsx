import { Shield, Lock, Headphones } from "lucide-react";
import { useTranslation } from "react-i18next";

export function TrustIndicators() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 rounded-lg border border-border bg-muted/30 py-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-brand-blue" />
        {t("subscription.plans.trust.secure")}
      </div>
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-brand-blue" />
        {t("subscription.plans.trust.encrypted")}
      </div>
      <div className="flex items-center gap-2">
        <Headphones className="h-4 w-4 text-brand-red" />
        {t("subscription.plans.trust.support")}
      </div>
    </div>
  );
}
