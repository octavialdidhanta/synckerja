import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { WeeklyHourRule } from "@/synckerja-order/shared/lib/orderHours";

const DAY_KEYS: Array<{ dow: number; key: string; fallback: string }> = [
  { dow: 1, key: "synckerjaOrder.hours.dow1", fallback: "Monday" },
  { dow: 2, key: "synckerjaOrder.hours.dow2", fallback: "Tuesday" },
  { dow: 3, key: "synckerjaOrder.hours.dow3", fallback: "Wednesday" },
  { dow: 4, key: "synckerjaOrder.hours.dow4", fallback: "Thursday" },
  { dow: 5, key: "synckerjaOrder.hours.dow5", fallback: "Friday" },
  { dow: 6, key: "synckerjaOrder.hours.dow6", fallback: "Saturday" },
  { dow: 7, key: "synckerjaOrder.hours.dow7", fallback: "Sunday" },
];

type Props = {
  outlets: Array<{ id: string; name: string; enabled: boolean }>;
  selectedOutletId: string | null;
  onSelectOutlet: (id: string) => void;
  forceClosed: boolean;
  weeklyHours: WeeklyHourRule[];
  onChange: (patch: { forceClosed?: boolean; weeklyHours?: WeeklyHourRule[] }) => void;
};

export function SynckerjaOrderHoursPanel({
  outlets,
  selectedOutletId,
  onSelectOutlet,
  forceClosed,
  weeklyHours,
  onChange,
}: Props) {
  const { t } = useAppTranslation();
  const enabledOutlets = outlets.filter((row) => row.enabled);
  const patchDay = (dow: number, next: Partial<WeeklyHourRule>) => {
    onChange({
      weeklyHours: weeklyHours.map((row) => (row.dow === dow ? { ...row, ...next } : row)),
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.hours.outlet", "Outlet")}</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selectedOutletId ?? ""}
          onChange={(e) => onSelectOutlet(e.target.value)}
        >
          {enabledOutlets.length === 0 ? (
            <option value="">{t("synckerjaOrder.hours.noOutlet", "Enable an outlet first.")}</option>
          ) : (
            enabledOutlets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div>
          <p className="text-sm font-medium">{t("synckerjaOrder.hours.forceClosed", "Temporarily closed")}</p>
          <p className="text-xs text-muted-foreground">
            {t("synckerjaOrder.hours.forceClosedHint", "Guests cannot add items or checkout until you reopen.")}
          </p>
        </div>
        <Switch checked={forceClosed} onCheckedChange={(v) => onChange({ forceClosed: v })} />
      </div>

      <div className="space-y-2">
        {DAY_KEYS.map((day) => {
          const rule = weeklyHours.find((row) => row.dow === day.dow);
          if (!rule) return null;
          return (
            <div key={day.dow} className="grid grid-cols-12 items-center gap-2 rounded-md border border-border px-3 py-2">
              <p className="col-span-12 text-sm font-medium sm:col-span-3">{t(day.key, day.fallback)}</p>
              <label className="col-span-12 flex items-center gap-2 text-xs sm:col-span-3">
                <Switch
                  checked={rule.closed}
                  onCheckedChange={(v) => patchDay(day.dow, { closed: v })}
                />
                {t("synckerjaOrder.hours.closedAllDay", "Closed all day")}
              </label>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs">{t("synckerjaOrder.hours.open", "Opens")}</Label>
                <input
                  type="time"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={rule.open}
                  disabled={rule.closed}
                  onChange={(e) => patchDay(day.dow, { open: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-xs">{t("synckerjaOrder.hours.close", "Closes")}</Label>
                <input
                  type="time"
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={rule.close}
                  disabled={rule.closed}
                  onChange={(e) => patchDay(day.dow, { close: e.target.value })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
