import { Button } from "@/mobile-app/components/ui/button";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { Separator } from "@/mobile-app/components/ui/separator";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CalendarDays, DollarSign, Users, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

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
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        showDragHandle={false}
        overlayClassName="z-[90]"
        className="z-[100] mt-0 flex min-h-0 max-h-[min(92dvh,100dvh)] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-background p-0 shadow-xl"
      >
        <DrawerHeader className="relative space-y-2 px-6 pb-3 pt-6 text-left">
          <DrawerClose asChild>
            <button
              type="button"
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              aria-label={t("subscription.plans.modal.options.close", "Tutup")}
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
          <DrawerTitle className="pr-10 text-lg font-semibold text-foreground">
            {t("subscription.plans.modal.options.formatTitle", "Pilih format perubahan")}
          </DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            {t("subscription.plans.modal.options.formatDescription", "Anda dapat menerapkan perubahan sekarang atau menjadwalkannya di akhir periode berjalan.")}
          </DrawerDescription>
        </DrawerHeader>
        <Separator className="flex-shrink-0" />
        <div
          className={cn(
            "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
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
        <DrawerFooter className="mt-0 flex-shrink-0 gap-0 border-t border-border bg-background px-6 pb-4 pt-4">
          <DrawerClose asChild>
            <Button variant="ghost" className="h-12 w-full rounded-full text-sm font-semibold">
              {t("subscription.plans.modal.options.close", "Tutup")}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

