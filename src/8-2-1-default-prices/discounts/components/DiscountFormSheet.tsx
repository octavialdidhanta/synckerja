import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { refreshNativeSafeAreaChromeInsets } from "@/shared/hooks/useNativeSafeAreaCssVars";
import {
  POS_PANEL,
  POS_SHEET_MOTION,
  POS_SHEET_OVERLAY_MOTION,
} from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { PosSafeAreaBottomSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaBottomSpacer";
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
  selectedOutletId?: string;
  /** POS library: full page, no black sheet overlay. */
  chrome?: "default" | "pos";
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

export function DiscountFormSheet({
  discount,
  open,
  onOpenChange,
  selectedOutletId,
  chrome = "default",
}: DiscountFormSheetProps) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
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
    refreshNativeSafeAreaChromeInsets();
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
      setOutletIds(selectedOutletId ? [selectedOutletId] : []);
    }
  }, [open, discount, selectedOutletId]);

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
  const close = () => onOpenChange(false);
  const posChrome = chrome === "pos";
  const saveLabel = discount
    ? t("common.save", "Save")
    : t("defaultPrices.discounts.createAction", "Create");

  const headerBar = (
    <div
      className="flex-shrink-0 border-b border-slate-200 bg-white"
      style={
        posChrome
          ? undefined
          : {
              paddingTop:
                "max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
            }
      }
    >
      <div
        className={cn(
          POS_PANEL.header,
          "flex-row items-center gap-1 space-y-0 border-b-0 px-1 text-left",
        )}
      >
        <button
          type="button"
          onClick={close}
          disabled={busy}
          className="inline-flex h-10 min-w-[4.25rem] flex-shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/80 disabled:opacity-40"
        >
          {t("common.cancel", "Cancel")}
        </button>
        {posChrome && isPhone ? (
          <h1 className={cn(POS_PANEL.headerTitle, "text-center leading-none")}>{title}</h1>
        ) : posChrome ? (
          <DialogTitle className={cn(POS_PANEL.headerTitle, "text-center leading-none")}>
            {title}
          </DialogTitle>
        ) : (
          <SheetTitle className={cn(POS_PANEL.headerTitle, "text-center leading-none")}>
            {title}
          </SheetTitle>
        )}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy}
          className="inline-flex h-10 min-w-[4.25rem] flex-shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-40"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );

  const formBody = (
    <div
      className={cn(
        "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
    >
          <div className={POS_PANEL.body}>
            <p className={cn(POS_PANEL.sectionTitle, "first:pt-0")}>
              {t("defaultPrices.discounts.section", "Discount information")}
            </p>

            <div className={cn(POS_PANEL.card, "mb-1")}>
              <div className={POS_PANEL.formRow}>
                <Input
                  id="discount-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("defaultPrices.discounts.namePlaceholder", "Name")}
                  className={POS_PANEL.formInput}
                  disabled={busy}
                  aria-label={t("defaultPrices.discounts.nameLabel", "Discount Name")}
                />
              </div>

              <div className={cn(POS_PANEL.formRow, "flex-col items-stretch gap-3")}>
                <span className="text-sm font-medium text-slate-800">
                  {t("defaultPrices.discounts.configLabel", "Input Configuration")}
                </span>
                <RadioGroup
                  value={inputConfiguration}
                  onValueChange={(value) =>
                    setInputConfiguration(value === "customizable" ? "customizable" : "fixed")
                  }
                  className="gap-3"
                  disabled={busy}
                >
                  <label className="flex cursor-pointer items-start gap-2">
                    <RadioGroupItem value="fixed" className="mt-0.5" />
                    <span>
                      <span className="block text-sm text-slate-800">
                        {t("defaultPrices.discounts.configFixed", "Fixed amount")}
                      </span>
                      <span className="block text-xs text-slate-500">
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
                      <span className="block text-sm text-slate-800">
                        {t("defaultPrices.discounts.configCustomizable", "Customizable amount")}
                      </span>
                      <span className="block text-xs text-slate-500">
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
                <div className={POS_PANEL.formRow}>
                  <span className={POS_PANEL.rowLabel}>
                    {t("defaultPrices.discounts.amountLabel", "Discount Amount")}
                  </span>
                  <div className="flex min-w-0 max-w-[65%] flex-1 items-stretch overflow-hidden rounded-md border border-slate-200 bg-white">
                    <Input
                      id="discount-amount"
                      inputMode={amountUnit === "percent" ? "decimal" : "numeric"}
                      value={amountDisplay}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder={t("defaultPrices.discounts.amountPlaceholder", "Amount")}
                      className="h-10 min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-right shadow-none focus-visible:ring-0"
                      disabled={busy}
                    />
                    <div className="inline-flex shrink-0 border-l border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleUnitChange("rp")}
                        disabled={busy}
                        className={cn(
                          "px-2.5 text-sm font-medium transition",
                          amountUnit === "rp"
                            ? "bg-primary text-primary-foreground"
                            : "bg-white text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        {t("defaultPrices.discounts.unitRp", "Rp")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnitChange("percent")}
                        disabled={busy}
                        className={cn(
                          "border-l border-slate-200 px-2.5 text-sm font-medium transition",
                          amountUnit === "percent"
                            ? "bg-primary text-primary-foreground"
                            : "bg-white text-slate-700 hover:bg-slate-50",
                        )}
                      >
                        {t("defaultPrices.discounts.unitPercent", "%")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <DiscountOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
            {!posChrome ? <div aria-hidden className="safe-area-bottom" /> : null}
          </div>
        </div>
  );

  const panel = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
      {headerBar}
      {formBody}
    </div>
  );

  if (posChrome && isPhone) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-slate-100">
        <PosSafeAreaTopSpacer />
        {panel}
        <PosSafeAreaBottomSpacer className="bg-slate-100" />
      </div>
    );
  }

  if (posChrome) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideCloseButton
          className="flex h-[min(94dvh,980px)] w-[min(94vw,560px)] max-h-[min(94dvh,980px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm [&>button]:hidden"
          aria-describedby={undefined}
        >
          {panel}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName={POS_SHEET_OVERLAY_MOTION}
        className={cn(
          "flex w-full flex-col gap-0 border-l border-slate-200 bg-slate-100 p-0 sm:max-w-md",
          POS_SHEET_MOTION,
          "[&>button]:hidden",
        )}
        aria-describedby={undefined}
      >
        {panel}
      </SheetContent>
    </Sheet>
  );
}
