import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useMidtransPayment } from "@/10-subscription/hooks/useMidtransPayment";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";
import { subscriptionQueryKeys } from "@/10-subscription/shared/subscriptionQueryKeys";
import { SalesModuleUpsellPage } from "@/shared/auth/module-access/SalesModuleUpsellPage";
import { formatSubscriptionDate } from "@/10-subscription/shared/subscriptionUtils";
import type { LeadMagnetUpsellKind } from "../hooks/useLeadMagnetEntitlement";

type LeadMagnetAddonUpsellPanelProps = {
  upsellKind: LeadMagnetUpsellKind;
  graceUntil?: string | null;
  graceDaysRemaining?: number | null;
  isSalesTenant?: boolean;
  billingCycle?: "monthly" | "yearly";
  className?: string;
};

export function LeadMagnetAddonUpsellPanel({
  upsellKind,
  graceUntil,
  graceDaysRemaining,
  isSalesTenant,
  billingCycle = "monthly",
  className,
}: LeadMagnetAddonUpsellPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId } = useActiveOrganization();
  const { initiateMidtransPayment, isLoading: paymentLoading } = useMidtransPayment({
    onPaymentStatusChange: () => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: subscriptionQueryKeys.status(organizationId) });
      }
    },
  });

  if (upsellKind === "digitalMarketing") {
    return <SalesModuleUpsellPage moduleKey="digitalMarketing" className={className} />;
  }

  if (upsellKind !== "leadMagnet") {
    return null;
  }

  const handlePurchase = () => {
    void initiateMidtransPayment({
      planName: t("leadMagnet.upsell.addOnName", "Lead Magnet"),
      amount: 0,
      memberCount: 1,
      billingCycle,
      purchaseKind: "lead_magnet_addon",
      checkoutSuccessRelativePath: "/digital-marketing/lead-magnet",
    });
  };

  return (
    <div className={className}>
      {graceDaysRemaining != null && graceUntil ? (
        <div className="mx-auto mb-4 w-full max-w-lg rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
          {t("leadMagnet.upsell.graceBanner", {
            date: formatSubscriptionDate(graceUntil, { month: "short" }),
            days: graceDaysRemaining,
            defaultValue:
              "Free access until {{date}} ({{days}} day(s) left). Purchase the add-on to keep using Lead Magnet.",
          })}
        </div>
      ) : null}
      <Card className="mx-auto w-full max-w-lg border-border/80 shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <Lock className="h-7 w-7 text-amber-800" aria-hidden />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">
              {t("leadMagnet.upsell.title", "Activate Lead Magnet add-on")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isSalesTenant
                ? t(
                    "leadMagnet.upsell.salesDescription",
                    "Contact the Synckerja team to activate the Lead Magnet add-on for your organization.",
                  )
                : t(
                    "leadMagnet.upsell.mandiriDescription",
                    "Purchase the Lead Magnet add-on to run comment-to-DM campaigns and capture leads from Instagram and Facebook.",
                  )}
            </p>
          </div>
          {!isSalesTenant ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={paymentLoading}
                onClick={handlePurchase}
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("leadMagnet.upsell.purchasing", "Opening payment…")}
                  </>
                ) : (
                  t("leadMagnet.upsell.buyAddOn", "Buy add-on")
                )}
              </Button>
              <Button variant="outline" className="w-full sm:w-auto" asChild>
                <Link to="/subscription/plans">{t("leadMagnet.upsell.viewPlans", "View subscription plans")}</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
