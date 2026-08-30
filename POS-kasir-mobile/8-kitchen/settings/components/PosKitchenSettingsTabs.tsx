import { Monitor, Palette, Store, Timer, X } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_KITCHEN_SETTINGS_I18N } from "../lib/posKitchenSettingsCopy";
import type { KitchenSettingsTabId } from "../lib/posKitchenSettingsTypes";

const TABS: {
  id: KitchenSettingsTabId;
  icon: typeof Monitor;
  labelKey: string;
  fallback: string;
}[] = [
  {
    id: "display_modes",
    icon: Monitor,
    labelKey: POS_KITCHEN_SETTINGS_I18N.tabDisplayModes,
    fallback: "Display Modes",
  },
  {
    id: "transition_times",
    icon: Timer,
    labelKey: POS_KITCHEN_SETTINGS_I18N.tabTransitionTimes,
    fallback: "Transition Times",
  },
  {
    id: "fonts_colors",
    icon: Palette,
    labelKey: POS_KITCHEN_SETTINGS_I18N.tabFontsColors,
    fallback: "Fonts And Colors",
  },
  {
    id: "assign_store",
    icon: Store,
    labelKey: POS_KITCHEN_SETTINGS_I18N.tabAssignStore,
    fallback: "Assign Store",
  },
];

type Props = {
  active: KitchenSettingsTabId;
  onChange: (id: KitchenSettingsTabId) => void;
  onClose?: () => void;
};

export function PosKitchenSettingsTabs({ active, onChange, onClose }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-shrink-0 items-stretch border-b border-slate-200 bg-white">
      <nav
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-4 pt-2"
        aria-label={t(POS_KITCHEN_SETTINGS_I18N.title, "Kitchen Display Settings")}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex flex-shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition",
                isActive
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(tab.labelKey, tab.fallback)}
            </button>
          );
        })}
      </nav>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="mx-2 mt-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center self-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label={t(POS_KITCHEN_SETTINGS_I18N.close, "Close")}
        >
          <X className="h-5 w-5" />
        </button>
      ) : null}
    </div>
  );
}
