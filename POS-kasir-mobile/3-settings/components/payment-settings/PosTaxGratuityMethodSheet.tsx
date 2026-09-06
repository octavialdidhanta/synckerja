import { useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import type { CatalogCheckoutApplicationMethod } from "@/8-2-1-default-prices/checkout/types";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateSection: (id: "tax" | "surcharge") => void;
};

/**
 * Choose whether catalog prices already include tax/fees (`include`)
 * or fees are added at checkout (`add`). Same `application_method` as Office checkout.
 *
 * - add: grand total = subtotal + gratuity + tax (charged to customer)
 * - include: grand total = subtotal; tax/gratuity lines still shown on receipt as breakdown
 */
export function PosTaxGratuityMethodSheet({
  open,
  onOpenChange,
  onNavigateSection,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const checkout = useCatalogCheckoutSettings();
  const [pending, setPending] = useState(false);

  const method: CatalogCheckoutApplicationMethod =
    checkout.settings?.application_method === "include" ? "include" : "add";

  const onMethodChange = async (next: CatalogCheckoutApplicationMethod) => {
    if (!checkout.settings || pending || checkout.isSaving) return;
    if (next === checkout.settings.application_method) return;
    setPending(true);
    try {
      await checkout.save({
        tax_enabled: checkout.settings.tax_enabled,
        gratuity_enabled: checkout.settings.gratuity_enabled,
        application_method: next,
      });
    } catch {
      toast({
        title: t(
          POS_SETTINGS_I18N.paymentSettingsSaveError,
          "Failed to update payment settings",
        ),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  };

  const go = (id: "tax" | "surcharge") => {
    onOpenChange(false);
    onNavigateSection(id);
  };

  const options: {
    value: CatalogCheckoutApplicationMethod;
    labelKey: string;
    fallback: string;
  }[] = [
    {
      value: "add",
      labelKey: POS_SETTINGS_I18N.paymentSettingsPricesExclude,
      fallback: "Product prices do not include Tax and Additional Fees",
    },
    {
      value: "include",
      labelKey: POS_SETTINGS_I18N.paymentSettingsPricesInclude,
      fallback: "Product prices already include Tax and Additional Fees",
    },
  ];

  const busy = pending || checkout.isSaving || !checkout.settings;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 border-l border-slate-200 bg-slate-100 p-0 sm:max-w-md",
          "[&>button]:hidden",
        )}
      >
        <div
          className="flex-shrink-0 border-b border-slate-200 bg-white"
          style={{
            paddingTop:
              "max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
          }}
        >
          <SheetHeader
            className={cn(POS_PANEL.header, "flex-row space-y-0 border-b-0 text-left")}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={POS_PANEL.headerBack}
              aria-label={t(POS_SETTINGS_I18N.back, "Back")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <SheetTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
              {t(
                POS_SETTINGS_I18N.paymentSettingsMethodSheetTitle,
                "Tax and Additional Fee Settings",
              )}
            </SheetTitle>
          </SheetHeader>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={POS_PANEL.body}>
            <div className={POS_PANEL.card}>
              {options.map((opt) => {
                const selected = method === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={busy}
                    onClick={() => void onMethodChange(opt.value)}
                    className={cn(
                      POS_PANEL.row,
                      "items-start text-left transition-colors hover:bg-slate-50 disabled:opacity-60",
                    )}
                  >
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                      {selected ? (
                        <Check className="h-5 w-5 text-primary" aria-hidden />
                      ) : null}
                    </span>
                    <span className={cn(POS_PANEL.rowLabel, "leading-snug")}>
                      {t(opt.labelKey, opt.fallback)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3 px-0.5 text-xs leading-relaxed text-slate-500">
              {method === "include"
                ? t(
                    POS_SETTINGS_I18N.paymentSettingsMethodHintInclude,
                    "Tax and fees already in the menu price.",
                  )
                : t(
                    POS_SETTINGS_I18N.paymentSettingsMethodHintAdd,
                    "Tax and fees added on top of the menu price.",
                  )}
            </p>

            <div className={cn(POS_PANEL.card, "mt-3")}>
              <button
                type="button"
                onClick={() => go("tax")}
                className={cn(
                  POS_PANEL.row,
                  "text-left transition-colors hover:bg-slate-50",
                )}
              >
                <span className={POS_PANEL.rowLabel}>
                  {t(POS_SETTINGS_I18N.paymentSettingsManageTax, "Manage Tax")}
                </span>
                <ChevronRight
                  className="h-5 w-5 flex-shrink-0 text-slate-400"
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => go("surcharge")}
                className={cn(
                  POS_PANEL.row,
                  "text-left transition-colors hover:bg-slate-50",
                )}
              >
                <span className={POS_PANEL.rowLabel}>
                  {t(
                    POS_SETTINGS_I18N.paymentSettingsManageSurcharge,
                    "Manage Additional Fees",
                  )}
                </span>
                <ChevronRight
                  className="h-5 w-5 flex-shrink-0 text-slate-400"
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
