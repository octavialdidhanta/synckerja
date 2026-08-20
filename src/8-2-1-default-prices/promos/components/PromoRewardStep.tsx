import { Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { DefaultPriceRow } from "../../types/defaultPrices";
import type { CatalogPromoAmountUnit, PromoDraft } from "../types";

export type PromoRewardStepProps = {
  draft: PromoDraft;
  onChange: (patch: Partial<PromoDraft>) => void;
  products: DefaultPriceRow[];
  onPrevious: () => void;
  onNext: () => void;
  canNext: boolean;
};

function parsePercentInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 1)}` : parts[0] ?? "";
}

function parseRpInput(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export function PromoRewardStep({
  draft,
  onChange,
  products,
  onPrevious,
  onNext,
  canNext,
}: PromoRewardStepProps) {
  const { t } = useAppTranslation();
  const productRows = products.filter((row) => row.kind === "product");
  const amountValid =
    draft.promo_type !== "discount_per_item" ||
    (draft.reward_amount_display.trim().length > 0 &&
      Number(draft.reward_amount_display) >= 0 &&
      (draft.reward_amount_unit === "rp" || Number(draft.reward_amount_display) <= 100));

  const handleAmountChange = (raw: string) => {
    onChange({
      reward_amount_display:
        draft.reward_amount_unit === "percent" ? parsePercentInput(raw) : parseRpInput(raw),
    });
  };

  const handleUnitChange = (unit: CatalogPromoAmountUnit) => {
    if (unit === draft.reward_amount_unit) return;
    onChange({ reward_amount_unit: unit, reward_amount_display: "" });
  };

  return (
    <div className="space-y-4">
      {draft.promo_type === "discount_per_item" ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t(
              "defaultPrices.promos.rewardDiscountHint",
              "Customers will get discount specified below to their cart",
            )}
          </p>
          <div className="flex min-w-0 items-stretch">
            <div className="relative min-w-0 flex-1">
              <Input
                inputMode={draft.reward_amount_unit === "percent" ? "decimal" : "numeric"}
                value={draft.reward_amount_display}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder={t("defaultPrices.promos.rewardAmount", "Discount Amount")}
                className={cn("rounded-r-none", amountValid && "pr-8")}
              />
              {amountValid ? (
                <Check className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
              ) : null}
            </div>
            <div className="inline-flex shrink-0 overflow-hidden rounded-r-md border border-l-0 border-input">
              <button
                type="button"
                onClick={() => handleUnitChange("percent")}
                className={cn(
                  "px-3 text-sm",
                  draft.reward_amount_unit === "percent"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-muted",
                )}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => handleUnitChange("rp")}
                className={cn(
                  "border-l border-input px-3 text-sm",
                  draft.reward_amount_unit === "rp"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:bg-muted",
                )}
              >
                Rp
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t(
              "defaultPrices.promos.rewardFreeHint",
              "Customers will get the free item specified below.",
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
            <div className="space-y-1.5">
              <Label>{t("defaultPrices.promos.qty", "Qty")}</Label>
              <Input
                inputMode="numeric"
                value={draft.reward_quantity}
                onChange={(e) => onChange({ reward_quantity: e.target.value.replace(/[^\d]/g, "") })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("defaultPrices.promos.freeItem", "Free item")}</Label>
              <Select
                value={draft.reward_product_id || undefined}
                onValueChange={(value) => onChange({ reward_product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("defaultPrices.promos.selectItem", "Select item")} />
                </SelectTrigger>
                <SelectContent>
                  {productRows.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name || product.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onPrevious}>
          {t("defaultPrices.promos.previous", "Previous")}
        </Button>
        <Button type="button" variant="outline" onClick={onNext} disabled={!canNext}>
          {t("defaultPrices.promos.next", "Next")}
        </Button>
      </div>
    </div>
  );
}
