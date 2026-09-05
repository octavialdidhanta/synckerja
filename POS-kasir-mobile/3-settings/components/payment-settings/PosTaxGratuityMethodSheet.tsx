import { useState } from "react";
import { Check } from "lucide-react";
import type { CatalogCheckoutApplicationMethod } from "@/8-2-1-default-prices/checkout/types";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
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
          "flex w-full flex-col gap-0 p-0 sm:max-w-md",
          // Keep the built-in X clear of the status bar (edge-to-edge Android).
          "[&>button]:top-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem),calc(var(--safe-area-inset-top,0px)+0.75rem))]",
        )}
      >
        <SheetHeader
          className="shrink-0 border-b px-4 pb-4 pr-12 text-left"
          style={{
            paddingTop:
              "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem), calc(var(--safe-area-inset-top, 0px) + 0.75rem))",
          }}
        >
          <SheetTitle>
            {t(
              POS_SETTINGS_I18N.paymentSettingsMethodSheetTitle,
              "Tax and Additional Fee Settings",
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {options.map((opt) => {
              const selected = method === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={busy}
                  onClick={() => void onMethodChange(opt.value)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3.5 text-left last:border-b-0",
                    "hover:bg-slate-50 disabled:opacity-60",
                  )}
                >
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
                    {selected ? (
                      <Check className="h-5 w-5 text-primary" aria-hidden />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-slate-900">
                    {t(opt.labelKey, opt.fallback)}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            {method === "include"
              ? t(
                  POS_SETTINGS_I18N.paymentSettingsMethodHintInclude,
                  "Included mode: customer pays the menu total only. Tax and fees still appear on the receipt as a breakdown.",
                )
              : t(
                  POS_SETTINGS_I18N.paymentSettingsMethodHintAdd,
                  "Excluded mode: tax and additional fees are added on top of the menu total and charged to the customer.",
                )}
          </p>
        </div>

        <div
          className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-background px-4 pt-3"
          style={{
            paddingBottom:
              "max(1rem, env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px), var(--footer-bottom-inset, 0px))",
          }}
        >
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-primary text-primary"
            onClick={() => go("tax")}
          >
            {t(POS_SETTINGS_I18N.paymentSettingsManageTax, "Manage Tax")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full border-primary text-primary"
            onClick={() => go("surcharge")}
          >
            {t(
              POS_SETTINGS_I18N.paymentSettingsManageSurcharge,
              "Manage Additional Fees",
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
