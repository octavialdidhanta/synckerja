import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogCheckoutSettings } from "../hooks/useCatalogCheckoutSettings";
import type { CatalogCheckoutApplicationMethod } from "../types";

export function LibraryCheckoutSettings() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { settings, isLoading, save, isSaving } = useCatalogCheckoutSettings();
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [gratuityEnabled, setGratuityEnabled] = useState(false);
  const [applicationMethod, setApplicationMethod] = useState<CatalogCheckoutApplicationMethod>("add");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTaxEnabled(settings.tax_enabled);
    setGratuityEnabled(settings.gratuity_enabled);
    setApplicationMethod(settings.application_method);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        tax_enabled: taxEnabled,
        gratuity_enabled: gratuityEnabled,
        application_method: applicationMethod,
      });
      toast({ title: t("defaultPrices.checkout.saved", "Checkout settings saved.") });
    } catch {
      toast({
        title: t("defaultPrices.form.saveFailed", "Failed to save."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving || isLoading;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("defaultPrices.checkout.heading", "Checkout")}
        </h2>
        <section className="space-y-4">
          <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("defaultPrices.checkout.section", "Tax and gratuity settings")}
          </p>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="checkout-tax-enabled">
              {t("defaultPrices.checkout.enableTax", "Enable Tax")}
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {taxEnabled
                  ? t("defaultPrices.checkout.on", "ON")
                  : t("defaultPrices.checkout.off", "OFF")}
              </span>
              <Switch
                id="checkout-tax-enabled"
                checked={taxEnabled}
                onCheckedChange={setTaxEnabled}
                disabled={busy}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="checkout-gratuity-enabled">
              {t("defaultPrices.checkout.enableGratuity", "Enable Gratuity")}
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {gratuityEnabled
                  ? t("defaultPrices.checkout.on", "ON")
                  : t("defaultPrices.checkout.off", "OFF")}
              </span>
              <Switch
                id="checkout-gratuity-enabled"
                checked={gratuityEnabled}
                onCheckedChange={setGratuityEnabled}
                disabled={busy}
              />
            </div>
          </div>
          <RadioGroup
            value={applicationMethod}
            onValueChange={(value) =>
              setApplicationMethod(value === "include" ? "include" : "add")
            }
            className="gap-3"
            disabled={busy}
          >
            <label className="flex cursor-pointer items-start gap-2">
              <RadioGroupItem value="add" className="mt-0.5" />
              <span className="text-sm">
                {t(
                  "defaultPrices.checkout.methodAdd",
                  "Add Tax and Gratuity to Item Price",
                )}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <RadioGroupItem value="include" className="mt-0.5" />
              <span className="text-sm">
                {t(
                  "defaultPrices.checkout.methodInclude",
                  "Include Tax and Gratuity to Item Price",
                )}
              </span>
            </label>
          </RadioGroup>
          <p className="text-sm text-muted-foreground">
            {t(
              "defaultPrices.checkout.methodNote",
              "These settings apply to both tax and gratuity.",
            )}
          </p>
        </section>
      </div>
      <div className="mt-6 flex shrink-0 justify-end border-t pt-4">
        <Button type="button" onClick={() => void handleSave()} disabled={busy}>
          {t("common.save", "Save")}
        </Button>
      </div>
    </div>
  );
}
