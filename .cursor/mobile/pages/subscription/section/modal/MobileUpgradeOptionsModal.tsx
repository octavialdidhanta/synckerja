import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/mobile/components/ui/dialog";
import { Button } from "@/mobile/components/ui/button";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Separator } from "@/mobile/components/ui/separator";
import { formatIDR } from "@/features/1-login/utils/subscriptionUtils";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { CalendarDays, DollarSign, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileUpgradeOptionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseImmediate: () => void;
  onChooseScheduled: () => void;
  immediateAmount: number;
  scheduledDate: string;
  planName: string;
  currentPlanName?: string;
  memberChange: {
    from: number;
    to: number;
  };
  proRateData?: {
    remainingDays: number;
    proRatePercentage: number;
    memberCostIncrease: number;
    currentPlanCredit: number;
  };
}

export const MobileUpgradeOptionsModal = ({
  open,
  onOpenChange,
  onChooseImmediate,
  onChooseScheduled,
  immediateAmount,
  scheduledDate,
  planName,
  currentPlanName = "Unknown Plan",
  memberChange,
  proRateData,
}: MobileUpgradeOptionsModalProps) => {
  const { t, language } = useAppTranslation();
  const dateLocale = language === "id" ? "id-ID" : "en-US";
  const formattedDate = scheduledDate
    ? new Date(scheduledDate).toLocaleDateString(dateLocale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "fixed inset-x-0 bottom-0 top-auto z-50 flex h-[90vh] max-h-[90vh] w-full translate-x-0 translate-y-0 flex-col rounded-t-3xl border border-border bg-background p-0 shadow-lg",
          "sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
        )}
      >
        <DialogHeader className="px-6 pb-3 pt-6 text-left">
          <DialogTitle className="text-lg font-semibold text-foreground">{t("subscription.plans.modal.options.formatTitle", "Pilih format perubahan")}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("subscription.plans.modal.options.formatDescription", "Anda dapat menerapkan perubahan sekarang atau menjadwalkannya di akhir periode berjalan.")}
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4 text-sm text-muted-foreground">
            <Card className="border border-border bg-muted/30">
              <CardContent className="space-y-3 p-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("subscription.plans.modal.confirm.summaryTitle", "Ringkasan perubahan")}
                  </h4>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span>{t("subscription.plans.modal.details.currentPlan", "Plan saat ini:").replace(":", "")}</span>
                      <span className="font-medium text-foreground">{currentPlanName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("subscription.plans.modal.details.newPlan", "Plan baru:").replace(":", "")}</span>
                      <span className="font-medium text-primary">{planName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("subscription.plans.modal.details.member", "Member:").replace(":", "")}</span>
                      <span className="font-medium text-foreground">
                        {memberChange.from} → {memberChange.to}
                      </span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-semibold">{t("subscription.plans.modal.options.prorateImmediate", "Kalkulasi prorate langsung")}</span>
                  </div>
                  <ul className="space-y-1 text-primary/80">
                    <li>{t("subscription.plans.modal.prorate.remainingDays", "Sisa hari subscription:")} {proRateData?.remainingDays ?? 30} {t("subscription.plans.modal.scheduled.days", "hari")}</li>
                    <li>{t("subscription.plans.modal.prorate.percentage", "Persentase prorate:")} {(proRateData?.proRatePercentage ?? 100).toFixed(1)}%</li>
                    <li>
                      {t("subscription.plans.modal.options.estimatedCost", "Perkiraan biaya tambahan:")}{" "}
                      <span className="font-semibold text-primary">
                        {formatIDR(immediateAmount)}
                      </span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("subscription.plans.modal.options.fastTrackDesc", "Jalur cepat cocok digunakan jika Anda ingin perubahan berlaku langsung. Sistem akan memproses pembayaran sesuai perhitungan prorate di atas.")}
                </div>
              </div>
              <Button className="h-12 w-full rounded-full text-sm font-semibold" onClick={onChooseImmediate}>
                {t("subscription.plans.modal.options.confirmPayNow", "Konfirmasi & Bayar Sekarang")} ({formatIDR(immediateAmount)})
              </Button>
            </div>

            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted text-muted-foreground p-2">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("subscription.plans.modal.options.scheduleDesc", "Jadwalkan perubahan agar otomatis diaplikasikan pada akhir periode berjalan tanpa biaya tambahan.")}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{t("subscription.plans.modal.scheduled.effectiveDate", "Tanggal efektif:").replace(":", "")}</p>
                <p>{formattedDate}</p>
              </div>
              <Button
                variant="outline"
                className="h-12 w-full rounded-full text-sm font-semibold"
                onClick={onChooseScheduled}
              >
                {t("subscription.plans.modal.options.scheduleEndPeriod", "Jadwalkan di akhir periode")}
              </Button>
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-background px-6 pb-6 pt-4">
          <Button
            variant="ghost"
            className="h-12 w-full rounded-full text-sm font-semibold"
            onClick={() => onOpenChange(false)}
          >
            {t("subscription.plans.modal.options.close", "Tutup")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

