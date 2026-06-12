import { AlertTriangle, CreditCard, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import type { SubscriptionExpiryStatus } from "@/10-subscription/hooks/useSubscriptionExpiry";
import { canManageSubscriptionRole } from "@/10-subscription/shared/subscriptionExpiryPolicy";

export function SubscriptionExpiredPage({
  expiryStatus,
}: {
  expiryStatus: SubscriptionExpiryStatus;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: orgData } = useUserOrganizations();

  const activeMembership = orgData?.memberships.find(
    (m) => m.organizationId === orgData.activeOrganizationId,
  );
  const organizationName = activeMembership?.companyName;
  const canRenew = canManageSubscriptionRole(activeMembership?.role);

  const formattedDate = expiryStatus.expiredDate
    ? new Date(expiryStatus.expiredDate).toLocaleDateString(
        i18n.language === "id" ? "id-ID" : "en-US",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : null;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-6 safe-area-top safe-area-bottom-lower">
      <Card className="w-full max-w-lg border-border/80 shadow-md">
        <CardContent className="flex flex-col items-center gap-6 px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              {t("subscription.expired.title", "Subscription expired")}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(
                "subscription.expired.description",
                "Your organization subscription has ended. Renew to continue using Synckerja.",
              )}
            </p>
            {organizationName ? (
              <p className="text-xs font-medium text-muted-foreground">{organizationName}</p>
            ) : null}
            {formattedDate ? (
              <p className="text-xs text-muted-foreground">
                {t("subscription.expired.endedOn", "Ended on {{date}}", { date: formattedDate })}
              </p>
            ) : null}
          </div>

          {canRenew ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => navigate("/subscription/plans")}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {t("subscription.expired.goToPlans", "Go to Plans")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => navigate("/subscription/management")}
              >
                <Settings className="mr-2 h-4 w-4" />
                {t("subscription.expired.goToManagement", "Subscription Management")}
              </Button>
            </div>
          ) : (
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t(
                "subscription.expired.contactAdmin",
                "Please contact your organization Owner or Admin to renew the subscription.",
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
