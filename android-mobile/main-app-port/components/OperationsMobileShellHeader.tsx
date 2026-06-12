import { SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SubscriptionExpiryBannerSlot } from "@/10-subscription/shared/SubscriptionExpiryBannerSlot";

export type OperationsMobileShellHeaderVariant = "schedule" | "clientVisit";

const HEADER_COPY: Record<
  OperationsMobileShellHeaderVariant,
  { titleKey: string; titleDefault: string; subtitleKey: string; subtitleDefault: string }
> = {
  schedule: {
    titleKey: "schedule.pageTitle",
    titleDefault: "Schedule",
    subtitleKey: "schedule.pageSubtitle",
    subtitleDefault: "Jadwal kerja dan hari libur",
  },
  clientVisit: {
    titleKey: "clientVisit.pageTitle",
    titleDefault: "Client Visit",
    subtitleKey: "clientVisit.pageSubtitle",
    subtitleDefault: "Kunjungan dan aktivitas client",
  },
};

type OperationsMobileShellHeaderProps = {
  variant: OperationsMobileShellHeaderVariant;
};

/** Title-only header when operations page access is denied. */
export function OperationsMobileShellHeader({ variant }: OperationsMobileShellHeaderProps) {
  const { t } = useAppTranslation();
  const copy = HEADER_COPY[variant];

  return (
    <>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="md:hidden shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-foreground">
              {t(copy.titleKey, copy.titleDefault)}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {t(copy.subtitleKey, copy.subtitleDefault)}
            </p>
          </div>
        </div>
        <div className="w-9 shrink-0" aria-hidden />
      </header>
      <SubscriptionExpiryBannerSlot />
    </>
  );
}
