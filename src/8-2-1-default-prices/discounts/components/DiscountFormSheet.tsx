import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogDiscounts } from "../hooks/useCatalogDiscounts";
import type {
  CatalogDiscount,
  CatalogDiscountAmountUnit,
  CatalogDiscountInputConfiguration,
} from "../types";
import { DiscountOutletsSection } from "./DiscountOutletsSection";

export type DiscountFormSheetProps = {
  discount: CatalogDiscount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatPercentDisplay(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

function parsePercentInput(raw: string): { display: string; value: number | null } {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");
  const display =
    parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 1)}` : parts[0] ?? "";
  if (!display) return { display: "", value: null };
  const n = Number(display);
  if (!Number.isFinite(n)) return { display, value: null };
  return { display, value: n };
}

function parseRpInput(raw: string): { display: string; value: number | null } {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { display: "", value: null };
  const n = Number(digits);
  if (!Number.isFinite(n)) return { display: digits, value: null };
  return { display: digits, value: n };
}

export function DiscountFormSheet({ discount, open, onOpenChange }: DiscountFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogDiscounts();
  const [name, setName] = useState("");
  const [inputConfiguration, setInputConfiguration] =
    useState<CatalogDiscountInputConfiguration>("fixed");
  const [amountUnit, setAmountUnit] = useState<CatalogDiscountAmountUnit>("rp");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (discount) {
      setName(discount.name);
      setInputConfiguration(discount.input_configuration);
      const unit = discount.amount_unit === "percent" ? "percent" : "rp";
      setAmountUnit(unit);
      if (discount.input_configuration === "fixed" && discount.amount_value != null) {
        setAmountDisplay(
          unit === "percent"
            ? formatPercentDisplay(discount.amount_value)
            : String(Math.round(discount.amount_value)),
        );
      } else {
        setAmountDisplay("");
      }
      setOutletIds([...(discount.outlet_ids ?? [])]);
    } else {
      setName("");
      setInputConfiguration("fixed");
      setAmountUnit("rp");
      setAmountDisplay("");
      setOutletIds([]);
    }
  }, [open, discount]);

  const parsedAmount =
    amountUnit === "percent" ? parsePercentInput(amountDisplay).value : parseRpInput(amountDisplay).value;
  const nameValid = name.trim().length > 0;
  const amountValid =
    parsedAmount != null &&
    parsedAmount >= 0 &&
    (amountUnit === "rp" || parsedAmount <= 100);
  const title = discount
    ? t("defaultPrices.discounts.editTitle", "Edit discount")
    : t("defaultPrices.discounts.addTitle", "New discount");

  const handleAmountChange = (raw: string) => {
    setAmountDisplay(
      amountUnit === "percent" ? parsePercentInput(raw).display : parseRpInput(raw).display,
    );
  };

  const handleUnitChange = (unit: CatalogDiscountAmountUnit) => {
    if (unit === amountUnit) return;
    setAmountUnit(unit);
    setAmountDisplay("");
  };

  const handleSave = async () => {
    if (!nameValid) {
      toast({
        title: t("defaultPrices.discounts.nameRequired", "Enter a discount name."),
        variant: "destructive",
      });
      return;
    }
    if (inputConfiguration === "fixed" && (!amountValid || parsedAmount == null)) {
      toast({
        title:
          amountUnit === "percent"
            ? t("defaultPrices.discounts.percentInvalid", "Enter an amount between 0 and 100.")
            : t("defaultPrices.discounts.amountRequired", "Enter a discount amount."),
        variant: "destructive",
      });
      return;
    }
    if (outletIds.length < 1) {
      toast({
        title: t("outlets.assign.minOne", "Please select minimum one outlet"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await save({
        id: discount?.id,
        name: name.trim(),
        input_configuration: inputConfiguration,
        amount_unit: inputConfiguration === "fixed" ? amountUnit : null,
        amount_value: inputConfiguration === "fixed" ? parsedAmount : null,
        outlet_ids: outletIds,
      });
      toast({ title: t("defaultPrices.discounts.saved", "Discount saved.") });
      onOpenChange(false);
    } catch {
      toast({
        title: t("defaultPrices.form.saveFailed", "Failed to save."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <section className="space-y-4">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("defaultPrices.discounts.section", "Discount information")}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="discount-name">
                {t("defaultPrices.discounts.nameLabel", "Discount Name")}
              </Label>
              <Input
                id="discount-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("defaultPrices.discounts.namePlaceholder", "Name")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("defaultPrices.discounts.configLabel", "Input Configuration")}</Label>
              <RadioGroup
                value={inputConfiguration}
                onValueChange={(value) =>
                  setInputConfiguration(value === "customizable" ? "customizable" : "fixed")
                }
                className="gap-3"
              >
                <label className="flex cursor-pointer items-start gap-2">
                  <RadioGroupItem value="fixed" className="mt-0.5" />
                  <span>
                    <span className="block text-sm">
                      {t("defaultPrices.discounts.configFixed", "Fixed amount")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(
                        "defaultPrices.discounts.configFixedHint",
                        "Amount configured in Back Office and cannot be changed in POS",
                      )}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <RadioGroupItem value="customizable" className="mt-0.5" />
                  <span>
                    <span className="block text-sm">
                      {t("defaultPrices.discounts.configCustomizable", "Customizable amount")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(
                        "defaultPrices.discounts.configCustomizableHint",
                        "Amount to be decided in POS",
                      )}
                    </span>
                  </span>
                </label>
              </RadioGroup>
            </div>
            {inputConfiguration === "fixed" ? (
              <div className="space-y-1.5">
                <Label htmlFor="discount-amount">
                  {t("defaultPrices.discounts.amountLabel", "Discount Amount")}
                </Label>
                <div className="flex min-w-0 items-stretch">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id="discount-amount"
                      inputMode={amountUnit === "percent" ? "decimal" : "numeric"}
                      value={amountDisplay}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder={t("defaultPrices.discounts.amountPlaceholder", "Amount")}
                      className="rounded-r-none"
                    />
                  </div>
                  <div className="inline-flex shrink-0 overflow-hidden rounded-r-md border border-l-0 border-input">
                    <button
                      type="button"
                      onClick={() => handleUnitChange("rp")}
                      className={cn(
                        "px-3 text-sm",
                        amountUnit === "rp"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {t("defaultPrices.discounts.unitRp", "Rp")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitChange("percent")}
                      className={cn(
                        "border-l border-input px-3 text-sm",
                        amountUnit === "percent"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {t("defaultPrices.discounts.unitPercent", "%")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
          <DiscountOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {discount
              ? t("common.save", "Save")
              : t("defaultPrices.discounts.createAction", "Create")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
