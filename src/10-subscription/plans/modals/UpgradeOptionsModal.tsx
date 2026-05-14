import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { CreditCard, Calendar } from "lucide-react";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseImmediate: () => void;
  onChooseScheduled: () => void;
  immediateAmount: number;
  scheduledDate: string;
  planName: string;
  currentPlanName?: string;
  memberChange: { from: number; to: number };
  proRateData?: {
    remainingDays: number;
    proRatePercentage: number;
    memberCostIncrease: number;
    currentPlanCredit: number;
    /** True when DB used full list price (no time-based prorate), e.g. Start Up → Scale Up. */
    skipProrate?: boolean;
  };
}

export function UpgradeOptionsModal({
  open,
  onOpenChange,
  onChooseImmediate,
  onChooseScheduled,
  immediateAmount,
  scheduledDate,
  planName,
  currentPlanName = "Unknown",
  memberChange,
  proRateData,
}: Props) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(i18n.language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("subscription.plans.modal.options.title")}</DialogTitle>
          <DialogDescription>
            {proRateData?.skipProrate
              ? t("subscription.plans.modal.options.descriptionNoSchedule", { planName })
              : t("subscription.plans.modal.options.description", { planName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("subscription.plans.modal.details.currentPlan")}</span>
            <span className="font-medium">{currentPlanName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("subscription.plans.modal.details.newPlan")}</span>
            <span className="font-medium">{planName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("subscription.plans.modal.details.members")}</span>
            <span className="font-medium">
              {memberChange.from} → {memberChange.to}
            </span>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            {!proRateData?.skipProrate && (
              <p className="text-xs text-muted-foreground">
                {t("subscription.plans.modal.prorate.remainingDays")}: {proRateData?.remainingDays ?? "—"} —{" "}
                {t("subscription.plans.modal.prorate.percentage")}: {proRateData?.proRatePercentage ?? "—"}%
              </p>
            )}
            <p
              className={`text-lg font-semibold text-foreground ${proRateData?.skipProrate ? "" : "mt-2"}`}
            >
              {formatIDR(immediateAmount)}
            </p>
            {!proRateData?.skipProrate && (
              <p className="text-xs text-muted-foreground">
                {t("subscription.plans.modal.scheduled.dateLabel")}: {formatDate(scheduledDate)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          {!proRateData?.skipProrate && (
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onChooseScheduled}>
              <Calendar className="mr-2 h-4 w-4" />
              {t("subscription.plans.modal.button.schedule")}
            </Button>
          )}
          <Button type="button" className="w-full sm:w-auto" onClick={onChooseImmediate}>
            <CreditCard className="mr-2 h-4 w-4" />
            {t("subscription.plans.modal.button.payNow")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
