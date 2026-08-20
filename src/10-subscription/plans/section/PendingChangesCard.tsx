import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { usePendingSubscriptionChanges } from "@/10-subscription/hooks/usePendingSubscriptionChanges";
import {
  LEAD_MAGNET_ADD_ON_CODE,
  OMNICHANNEL_ROSTER_ADD_ON_CODE,
  POS_OUTLETS_ADD_ON_CODE,
} from "@/10-subscription/shared/subscriptionUtils";

export function PendingChangesCard() {
  const { t, i18n } = useTranslation();
  const { data: pending, isLoading, cancelPending, applyDue } = usePendingSubscriptionChanges();

  useEffect(() => {
    applyDue.mutate();
    // Best-effort apply on plans page load; hourly cron is primary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !pending) return null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(i18n.language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const omniTarget = pending.target_addon_selections?.[OMNICHANNEL_ROSTER_ADD_ON_CODE];
  const lmTarget = pending.target_addon_selections?.[LEAD_MAGNET_ADD_ON_CODE];
  const posTarget = pending.target_addon_selections?.[POS_OUTLETS_ADD_ON_CODE];

  return (
    <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
          <Calendar className="h-4 w-4" />
          {t("subscription.plans.pendingChanges.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-amber-950 dark:text-amber-50/90">
        <p>{t("subscription.plans.pendingChanges.effective", { date: formatDate(pending.scheduled_date) })}</p>
        <ul className="list-inside list-disc space-y-1 text-xs">
          {pending.target_member_count !== pending.current_member_count && (
            <li>
              {t("subscription.plans.pendingChanges.memberChange", {
                from: pending.current_member_count,
                to: pending.target_member_count,
              })}
            </li>
          )}
          {pending.target_billing_cycle && (
            <li>{t("subscription.plans.pendingChanges.billing", { cycle: pending.target_billing_cycle })}</li>
          )}
          {omniTarget && (
            <li>
              {omniTarget.included
                ? t("subscription.plans.pendingChanges.omniSeats", { count: omniTarget.quantity })
                : t("subscription.plans.pendingChanges.omniOff")}
            </li>
          )}
          {lmTarget && (
            <li>
              {lmTarget.included
                ? t("subscription.plans.pendingChanges.leadMagnetOn")
                : t("subscription.plans.pendingChanges.leadMagnetOff")}
            </li>
          )}
          {posTarget && (
            <li>
              {posTarget.included
                ? t("subscription.plans.pendingChanges.posOutlets", { count: posTarget.quantity })
                : t("subscription.plans.pendingChanges.posOff")}
            </li>
          )}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-300 bg-white/80 hover:bg-white"
          disabled={cancelPending.isPending}
          onClick={() => cancelPending.mutate(pending.id)}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          {t("subscription.plans.pendingChanges.cancel")}
        </Button>
      </CardContent>
    </Card>
  );
}
