import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PromoDraft } from "../types";

export type PromoConfigurationStepProps = {
  draft: PromoDraft;
  onChange: (patch: Partial<PromoDraft>) => void;
  onPrevious: () => void;
};

export function PromoConfigurationStep({ draft, onChange, onPrevious }: PromoConfigurationStepProps) {
  const { t } = useAppTranslation();

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={draft.applies_in_multiple}
          onCheckedChange={(value) => onChange({ applies_in_multiple: value === true })}
        />
        <span>
          <span className="block text-sm">
            {t("defaultPrices.promos.appliesMultiple", "Applies in multiple")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(
              "defaultPrices.promos.appliesMultipleHint",
              "(e.g. if there is a '5% off', customer who buy 2 will get 5% off for 2 items, buy 3 will get 5% off for 3 items, etc.)",
            )}
          </span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox
          className="mt-0.5"
          checked={draft.time_period_enabled}
          onCheckedChange={(value) =>
            onChange({
              time_period_enabled: value === true,
              starts_on: value === true ? draft.starts_on : "",
              ends_on: value === true ? draft.ends_on : "",
              starts_at_time: value === true ? draft.starts_at_time : "",
              ends_at_time: value === true ? draft.ends_at_time : "",
            })
          }
        />
        <span>
          <span className="block text-sm">
            {t("defaultPrices.promos.setPeriod", "Set promo time period")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(
              "defaultPrices.promos.setPeriodHint",
              "By not setting a promo time period, this promo will run forever starting tomorrow. You can setup it later.",
            )}
          </span>
        </span>
      </label>

      {draft.time_period_enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="promo-starts-on">{t("defaultPrices.promos.startsOn", "Start date")}</Label>
            <Input
              id="promo-starts-on"
              type="date"
              value={draft.starts_on}
              onChange={(e) => onChange({ starts_on: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-ends-on">{t("defaultPrices.promos.endsOn", "End date")}</Label>
            <Input
              id="promo-ends-on"
              type="date"
              value={draft.ends_on}
              onChange={(e) => onChange({ ends_on: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-starts-at">{t("defaultPrices.promos.startsAt", "Start time")}</Label>
            <Input
              id="promo-starts-at"
              type="time"
              value={draft.starts_at_time}
              onChange={(e) => onChange({ starts_at_time: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-ends-at">{t("defaultPrices.promos.endsAt", "End time")}</Label>
            <Input
              id="promo-ends-at"
              type="time"
              value={draft.ends_at_time}
              onChange={(e) => onChange({ ends_at_time: e.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onPrevious}>
          {t("defaultPrices.promos.previous", "Previous")}
        </Button>
      </div>
    </div>
  );
}
