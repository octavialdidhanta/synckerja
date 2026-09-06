import { useEffect, useState } from "react";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  formatIdrThousandsFromDigits,
  idrDigitsOnly,
  parseIdrInputToNumber,
} from "@/shared/lib/idrInputFormat";
import { cn } from "@/shared/lib/utils";
import { formatPosCash } from "../lib/formatPosCash";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import { POS_SHIFT_PANEL } from "../lib/posShiftPanelChrome";
import { usePosOutletShiftSettings } from "../lib/usePosOutletShiftSettings";

type Props = {
  outletId: string;
};

/**
 * Pilihan Shift — auto-start toggle + default opening cash (gambar 1).
 */
export function PosShiftOptionsPanel({ outletId }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { settings, isLoading, save, isSaving } = usePosOutletShiftSettings(outletId);

  const [autoStart, setAutoStart] = useState(false);
  const [cashDigits, setCashDigits] = useState("100000");

  useEffect(() => {
    if (!settings) return;
    setAutoStart(settings.auto_start_enabled);
    setCashDigits(String(Math.round(settings.default_opening_cash || 0)));
  }, [settings]);

  const persist = async (next: {
    auto_start_enabled: boolean;
    default_opening_cash: number;
  }) => {
    try {
      await save(next);
      toast({ title: t(POS_SHIFT_I18N.settingsSaved, "Shift settings saved.") });
    } catch {
      toast({
        title: t(POS_SHIFT_I18N.saveFailed, "Failed to save shift settings."),
        variant: "destructive",
      });
    }
  };

  if (isLoading && !settings) {
    return (
      <div className={POS_SHIFT_PANEL.body} aria-busy>
        <div className={POS_SHIFT_PANEL.card}>
          <div className={POS_SHIFT_PANEL.row}>
            <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-slate-100" />
            <div className="h-6 w-10 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className={POS_SHIFT_PANEL.row}>
            <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(POS_SHIFT_PANEL.page, "bg-transparent")}>
      <div className={POS_SHIFT_PANEL.body}>
        <div className={POS_SHIFT_PANEL.card}>
          <div className={POS_SHIFT_PANEL.row}>
            <span className={POS_SHIFT_PANEL.rowLabel}>
              {t(POS_SHIFT_I18N.autoStart, "Start Shift Automatically")}
            </span>
            <Switch
              checked={autoStart}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                setAutoStart(checked);
                const amount = parseIdrInputToNumber(cashDigits);
                void persist({
                  auto_start_enabled: checked,
                  default_opening_cash: Number.isFinite(amount) ? amount : 0,
                });
              }}
            />
          </div>
          <div className={POS_SHIFT_PANEL.row}>
            <span className={POS_SHIFT_PANEL.rowLabel}>
              {t(
                POS_SHIFT_I18N.defaultOpeningCash,
                "Starting Cash Balance in Cash Drawer",
              )}
            </span>
            <div className="flex flex-shrink-0 items-center gap-1">
              <span className="text-sm text-slate-500">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={isSaving}
                value={formatIdrThousandsFromDigits(cashDigits)}
                onChange={(e) => setCashDigits(idrDigitsOnly(e.target.value) || "0")}
                onBlur={() => {
                  const amount = parseIdrInputToNumber(cashDigits);
                  void persist({
                    auto_start_enabled: autoStart,
                    default_opening_cash: Number.isFinite(amount) ? amount : 0,
                  });
                }}
                className="w-28 border-0 bg-transparent text-right text-sm font-semibold tabular-nums text-slate-900 outline-none"
                aria-label={formatPosCash(parseIdrInputToNumber(cashDigits) || 0)}
              />
            </div>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-md px-1 text-center text-sm leading-relaxed text-slate-400">
          {t(
            POS_SHIFT_I18N.optionsHint,
            "Shifts let you track cash, card, and other payments in and out of the cash drawer.",
          )}
        </p>
      </div>
    </div>
  );
}
