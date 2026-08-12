import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";

type Props = {
  onlyRunning: boolean;
  onOnlyRunningChange: (checked: boolean) => void;
  enabledOnly: boolean;
  onEnabledOnlyChange: (checked: boolean) => void;
  /** Prefix switch ids when both desktop and mobile may mount in one document. */
  idPrefix?: string;
  className?: string;
};

export function GoogleAdsDeliveryEnabledSwitches({
  onlyRunning,
  onOnlyRunningChange,
  enabledOnly,
  onEnabledOnlyChange,
  idPrefix = "google-ads",
  className,
}: Props) {
  const { t } = useAppTranslation();
  const onlyRunningId = `${idPrefix}-only-running`;
  const enabledOnlyId = `${idPrefix}-enabled-only`;

  return (
    <div className={cn("flex shrink-0 items-center gap-3", className)}>
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          id={onlyRunningId}
          className="scale-90"
          checked={onlyRunning}
          onCheckedChange={onOnlyRunningChange}
        />
        <Label
          htmlFor={onlyRunningId}
          className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground"
          title={t(
            "digitalMarketing.googleAds.onlyRunning",
            "Only keywords/rows with impressions or cost in this date range. Off = closer to Google Ads row count.",
          )}
        >
          {t("digitalMarketing.googleAds.onlyRunningShort", "Delivery")}
        </Label>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Switch
          id={enabledOnlyId}
          className="scale-90"
          checked={enabledOnly}
          onCheckedChange={onEnabledOnlyChange}
        />
        <Label
          htmlFor={enabledOnlyId}
          className="cursor-pointer whitespace-nowrap text-xs text-muted-foreground"
          title={t(
            "digitalMarketing.googleAds.enabledOnly",
            "Enabled status only",
          )}
        >
          {t("digitalMarketing.googleAds.enabledOnlyShort", "Enabled")}
        </Label>
      </div>
    </div>
  );
}
