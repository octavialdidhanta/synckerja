import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import type { SubscriptionExpiryStatus } from "@/10-subscription/hooks/useSubscriptionExpiry";

export function SubscriptionExpiredPage({
  expiryStatus,
}: {
  expiryStatus: SubscriptionExpiryStatus;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{t("subscription.expired.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subscription.expired.description")}</p>
        {expiryStatus.expiredDate && (
          <p className="text-xs text-muted-foreground">
            {t("subscription.expired.endedOn", { date: new Date(expiryStatus.expiredDate).toLocaleDateString() })}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => navigate("/subscription/plans")}>
          {t("subscription.expired.goToPlans")}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/subscription/management")}>
          {t("subscription.expired.goToManagement")}
        </Button>
      </div>
    </div>
  );
}
