import { Monitor } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";
import type { KitchenDisplayMode } from "../../lib/posKitchenSettingsTypes";

type Props = {
  value: KitchenDisplayMode;
  onChange: (mode: KitchenDisplayMode) => void;
};

export function PosKitchenDisplayModesPanel({ value, onChange }: Props) {
  const { t } = useAppTranslation();

  const cards: {
    id: KitchenDisplayMode;
    titleKey: string;
    titleFb: string;
    descKey: string;
    descFb: string;
  }[] = [
    {
      id: "classic",
      titleKey: POS_KITCHEN_SETTINGS_I18N.classicTitle,
      titleFb: "Classic",
      descKey: POS_KITCHEN_SETTINGS_I18N.classicDesc,
      descFb: "Left to right. One horizontal row of tickets. Simple and clean.",
    },
    {
      id: "tiled",
      titleKey: POS_KITCHEN_SETTINGS_I18N.tiledTitle,
      titleFb: "Tiled",
      descKey: POS_KITCHEN_SETTINGS_I18N.tiledDesc,
      descFb:
        "Top to bottom, left to right. Tickets fill in where they fit. Most tickets on screen.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => {
        const selected = value === card.id;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onChange(card.id)}
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl border-2 bg-white p-4 text-left transition",
              selected
                ? "border-slate-900 shadow-sm"
                : "border-slate-200 hover:border-slate-300",
            )}
          >
            <div
              className={cn(
                "flex h-20 w-full items-center justify-center rounded-lg",
                selected ? "bg-slate-100" : "bg-slate-50",
              )}
            >
              <Monitor
                className={cn(
                  "h-10 w-10",
                  selected ? "text-slate-900" : "text-slate-400",
                )}
                aria-hidden
              />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
                {t(card.titleKey, card.titleFb)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {t(card.descKey, card.descFb)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
