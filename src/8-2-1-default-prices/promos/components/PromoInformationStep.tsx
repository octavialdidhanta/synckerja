import { Check, Gift, Percent } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CatalogSalesType } from "../../sales-types/types";
import type { CatalogPromoType, PromoDraft } from "../types";
import { AssignPromoOutletDialog } from "./AssignPromoOutletDialog";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { summarizeAssignedOutlets } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useState } from "react";

export type PromoInformationStepProps = {
  draft: PromoDraft;
  onChange: (patch: Partial<PromoDraft>) => void;
  salesTypes: CatalogSalesType[];
  onNext: () => void;
  canNext: boolean;
};

export function PromoInformationStep({
  draft,
  onChange,
  salesTypes,
  onNext,
  canNext,
}: PromoInformationStepProps) {
  const { t } = useAppTranslation();
  const { rows: outlets } = usePosOutlets();
  const [outletOpen, setOutletOpen] = useState(false);
  const nameValid = draft.name.trim().length > 0;
  const outletSummary = summarizeAssignedOutlets(outlets, draft.outlet_ids);

  const toggleSalesType = (id: string, checked: boolean) => {
    const next = new Set(draft.sales_type_ids);
    if (checked) next.add(id);
    else next.delete(id);
    onChange({ sales_type_ids: [...next] });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("defaultPrices.promos.selectType", "Select Promo type")}
        </p>
        <RadioGroup
          value={draft.promo_type}
          onValueChange={(value) =>
            onChange({ promo_type: value === "free_item" ? "free_item" : "discount_per_item" })
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          {(
            [
              {
                value: "discount_per_item" as CatalogPromoType,
                title: t("defaultPrices.promos.typeDiscount", "Discount per Item"),
                hint: t(
                  "defaultPrices.promos.typeDiscountHint",
                  "Customers get a discount (by % or amount) automatically when they buy the specified item and quantity.",
                ),
                icon: Percent,
              },
              {
                value: "free_item" as CatalogPromoType,
                title: t("defaultPrices.promos.typeFree", "Free Item"),
                hint: t(
                  "defaultPrices.promos.typeFreeHint",
                  "Customers get a free item automatically when they buy the specified item and quantity.",
                ),
                icon: Gift,
              },
            ] as const
          ).map((card) => {
            const Icon = card.icon;
            const selected = draft.promo_type === card.value;
            return (
              <label
                key={card.value}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-lg border p-4",
                  selected ? "border-primary" : "border-input",
                )}
              >
                <RadioGroupItem value={card.value} className="absolute left-3 top-3" />
                <div className="mb-3 flex justify-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="text-center text-sm font-semibold">{card.title}</p>
                <p className="mt-1 text-center text-xs text-muted-foreground">{card.hint}</p>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="promo-name">{t("defaultPrices.promos.nameLabel", "Promo Name")}</Label>
        <div className="relative">
          <Input
            id="promo-name"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t(
              "defaultPrices.promos.namePlaceholder",
              "Write Promo Name (e.g. Discount Big Sale)",
            )}
            className={cn(nameValid && "pr-8")}
          />
          {nameValid ? (
            <Check className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t("defaultPrices.promos.whereLabel", "Where do you want to implement this promo?")}
        </p>
        <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("defaultPrices.promos.assignedOutlets", "Assigned outlets")}
        </p>
        <Button type="button" className="w-full" onClick={() => setOutletOpen(true)}>
          {t("defaultPrices.promos.assignOutlet", "Assign Outlet")}
        </Button>
        {outletSummary.names.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {outletSummary.names.join(", ")}
            {outletSummary.extra > 0 ? ` +${outletSummary.extra}` : ""}
          </p>
        ) : (
          <p className="text-sm text-destructive">
            {t("outlets.assign.minOne", "Please select minimum one outlet")}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          {t("defaultPrices.promos.assignSalesType", "Assign Sales Type")}
        </p>
        <RadioGroup
          value={draft.sales_type_scope}
          onValueChange={(value) =>
            onChange({ sales_type_scope: value === "specific" ? "specific" : "all" })
          }
          className="gap-3"
        >
          <label className="flex cursor-pointer items-start gap-2">
            <RadioGroupItem value="all" className="mt-0.5" />
            <span>
              <span className="block text-sm">
                {t("defaultPrices.promos.salesTypeAll", "All Sales Type")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(
                  "defaultPrices.promos.salesTypeAllHint",
                  "Promo will apply to current and upcoming sales type.",
                )}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <RadioGroupItem value="specific" className="mt-0.5" />
            <span>
              <span className="block text-sm">
                {t("defaultPrices.promos.salesTypeSpecific", "Specific Sales Type")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(
                  "defaultPrices.promos.salesTypeSpecificHint",
                  "Choose the selected sales type for this promo.",
                )}
              </span>
            </span>
          </label>
        </RadioGroup>
        {draft.sales_type_scope === "specific" ? (
          salesTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("defaultPrices.promos.salesTypeEmpty", "No sales types yet. Add them on Sales Type.")}
            </p>
          ) : (
            <ul className="space-y-1">
              {salesTypes.map((row) => (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                    <Checkbox
                      checked={draft.sales_type_ids.includes(row.id)}
                      onCheckedChange={(value) => toggleSalesType(row.id, value === true)}
                    />
                    <span className="text-sm">{row.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onNext} disabled={!canNext}>
          {t("defaultPrices.promos.next", "Next")}
        </Button>
      </div>
      <AssignPromoOutletDialog
        open={outletOpen}
        onOpenChange={setOutletOpen}
        selectedIds={draft.outlet_ids}
        onConfirm={(ids) => onChange({ outlet_ids: ids })}
      />
    </div>
  );
}
