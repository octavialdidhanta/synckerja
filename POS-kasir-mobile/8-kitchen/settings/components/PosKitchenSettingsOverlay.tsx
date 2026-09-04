import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { useEnsureDefaultKitchenSalesTypes } from "../hooks/useEnsureDefaultKitchenSalesTypes";
import { usePosKitchenOutletSettings } from "../hooks/usePosKitchenOutletSettings";
import type {
  KitchenFontSize,
  KitchenThemeColors,
} from "../lib/defaultKitchenTheme";
import {
  DEFAULT_KITCHEN_FONT_SIZE,
  DEFAULT_KITCHEN_THEME_COLORS,
} from "../lib/defaultKitchenTheme";
import { kitchenThemeColorsEqual } from "../lib/parseKitchenThemePrefs";
import { kitchenFirePolicyEqual } from "../../lib/kitchenFirePolicy";
import { POS_KITCHEN_SETTINGS_I18N } from "../lib/posKitchenSettingsCopy";
import {
  DEFAULT_KITCHEN_DISPLAY_MODE,
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  DEFAULT_ORDER_TYPE_VISIBILITY,
  type KitchenDisplayMode,
  type KitchenFireBySalesType,
  type KitchenOrderTypeVisibility,
  type KitchenSettingsTabId,
} from "../lib/posKitchenSettingsTypes";
import { PosKitchenAssignStorePanel } from "./assign-store/PosKitchenAssignStorePanel";
import { PosKitchenDisplayModesPanel } from "./display-modes/PosKitchenDisplayModesPanel";
import { PosKitchenFontsColorsPanel } from "./fonts-colors/PosKitchenFontsColorsPanel";
import { PosKitchenOrderTypesPanel } from "./order-types/PosKitchenOrderTypesPanel";
import { PosKitchenTransitionTimesPanel } from "./transition-times/PosKitchenTransitionTimesPanel";
import { PosKitchenSettingsTabs } from "./PosKitchenSettingsTabs";

type Props = {
  outletId: string;
  outletName: string;
  onClose: () => void;
};

function visibilityEqual(
  a: KitchenOrderTypeVisibility,
  b: KitchenOrderTypeVisibility,
): boolean {
  return (
    a.dine_in === b.dine_in &&
    a.takeaway === b.takeaway &&
    a.delivery === b.delivery &&
    a.pickup === b.pickup
  );
}

function cloneColors(colors: KitchenThemeColors): KitchenThemeColors {
  return {
    order_types: { ...colors.order_types },
    status: { ...colors.status },
  };
}

/**
 * Full-bleed KDS settings overlay (not the POS blue menu drawer).
 * Top/bottom safe-area bands keep tabs and Save clear of system chrome.
 */
export function PosKitchenSettingsOverlay({
  outletId,
  outletName,
  onClose,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const settingsQuery = usePosKitchenOutletSettings(outletId);
  const ensureDefaults = useEnsureDefaultKitchenSalesTypes(outletId);

  const [tab, setTab] = useState<KitchenSettingsTabId>("display_modes");
  const [draftMode, setDraftMode] = useState<KitchenDisplayMode>(
    DEFAULT_KITCHEN_DISPLAY_MODE,
  );
  const [draftVisibility, setDraftVisibility] =
    useState<KitchenOrderTypeVisibility>({ ...DEFAULT_ORDER_TYPE_VISIBILITY });
  const [draftFontSize, setDraftFontSize] = useState<KitchenFontSize>(
    DEFAULT_KITCHEN_FONT_SIZE,
  );
  const [draftColors, setDraftColors] = useState<KitchenThemeColors>(
    cloneColors(DEFAULT_KITCHEN_THEME_COLORS),
  );
  const [draftFirePolicy, setDraftFirePolicy] = useState<KitchenFireBySalesType>({
    ...DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void ensureDefaults.mutateAsync().catch(() => {
      /* non-blocking; Order Types UI still works with buckets */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when overlay opens
  }, [outletId]);

  useEffect(() => {
    if (!settingsQuery.data || hydrated) return;
    setDraftMode(settingsQuery.data.display_mode);
    setDraftVisibility({ ...settingsQuery.data.order_type_visibility });
    setDraftFontSize(settingsQuery.data.font_size);
    setDraftColors(cloneColors(settingsQuery.data.colors));
    setDraftFirePolicy({ ...settingsQuery.data.kitchen_fire_by_sales_type });
    setHydrated(true);
  }, [settingsQuery.data, hydrated]);

  const savedMode = settingsQuery.data?.display_mode ?? DEFAULT_KITCHEN_DISPLAY_MODE;
  const savedVisibility =
    settingsQuery.data?.order_type_visibility ?? DEFAULT_ORDER_TYPE_VISIBILITY;
  const savedFontSize = settingsQuery.data?.font_size ?? DEFAULT_KITCHEN_FONT_SIZE;
  const savedColors =
    settingsQuery.data?.colors ?? DEFAULT_KITCHEN_THEME_COLORS;
  const savedFirePolicy =
    settingsQuery.data?.kitchen_fire_by_sales_type ?? DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE;

  const dirty = useMemo(() => {
    if (!hydrated) return false;
    return (
      draftMode !== savedMode ||
      !visibilityEqual(draftVisibility, savedVisibility) ||
      draftFontSize !== savedFontSize ||
      !kitchenThemeColorsEqual(draftColors, savedColors) ||
      !kitchenFirePolicyEqual(draftFirePolicy, savedFirePolicy)
    );
  }, [
    hydrated,
    draftMode,
    savedMode,
    draftVisibility,
    savedVisibility,
    draftFontSize,
    savedFontSize,
    draftColors,
    savedColors,
    draftFirePolicy,
    savedFirePolicy,
  ]);

  const showSave =
    tab === "display_modes" || tab === "fonts_colors" || tab === "transition_times";

  const onSave = async () => {
    try {
      await settingsQuery.save.mutateAsync({
        display_mode: draftMode,
        order_type_visibility: draftVisibility,
        font_size: draftFontSize,
        colors: draftColors,
        kitchen_fire_by_sales_type: draftFirePolicy,
      });
      toast({
        title: t(POS_KITCHEN_SETTINGS_I18N.saveSuccess, "Settings saved"),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_KITCHEN_SETTINGS_I18N.saveError, "Could not save settings"),
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white">
      <PosSafeAreaTopSpacer />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
        <PosKitchenSettingsTabs active={tab} onChange={setTab} onClose={onClose} />

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
          {tab === "display_modes" ? (
            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_280px]">
              <PosKitchenDisplayModesPanel value={draftMode} onChange={setDraftMode} />
              <PosKitchenOrderTypesPanel
                value={draftVisibility}
                onChange={setDraftVisibility}
              />
            </div>
          ) : null}
          {tab === "fonts_colors" ? (
            <PosKitchenFontsColorsPanel
              fontSize={draftFontSize}
              colors={draftColors}
              onFontSizeChange={setDraftFontSize}
              onColorsChange={setDraftColors}
            />
          ) : null}
          {tab === "transition_times" ? (
            <PosKitchenTransitionTimesPanel
              value={draftFirePolicy}
              onChange={setDraftFirePolicy}
            />
          ) : null}
          {tab === "assign_store" ? (
            <PosKitchenAssignStorePanel
              outletName={outletName}
              onBeforeNavigateToPos={onClose}
            />
          ) : null}
        </div>

        {showSave ? (
          <footer className="flex flex-shrink-0 flex-col border-t border-slate-200 bg-white safe-area-bottom">
            <div className="flex justify-end px-4 py-3">
              <button
                type="button"
                disabled={!dirty || settingsQuery.save.isPending}
                onClick={() => void onSave()}
                className="min-h-11 rounded-lg bg-teal-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-40"
              >
                {t(POS_KITCHEN_SETTINGS_I18N.saveChanges, "Save Changes")}
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
