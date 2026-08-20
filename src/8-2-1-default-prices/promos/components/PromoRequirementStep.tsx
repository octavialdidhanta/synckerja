import { CircleX } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CatalogProductCategory } from "../../categories";
import type { DefaultPriceRow } from "../../types/defaultPrices";
import type { PromoDraft, PromoRequirementDraft } from "../types";
import { newRequirementDraft } from "../types";

export type PromoRequirementStepProps = {
  draft: PromoDraft;
  onChange: (patch: Partial<PromoDraft>) => void;
  products: DefaultPriceRow[];
  categories: CatalogProductCategory[];
  onPrevious: () => void;
  onNext: () => void;
  canNext: boolean;
};

export function PromoRequirementStep({
  draft,
  onChange,
  products,
  categories,
  onPrevious,
  onNext,
  canNext,
}: PromoRequirementStepProps) {
  const { t } = useAppTranslation();
  const productRows = products.filter((row) => row.kind === "product");

  const updateRow = (key: string, patch: Partial<PromoRequirementDraft>) => {
    onChange({
      requirements: draft.requirements.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    });
  };

  const removeRow = (key: string) => {
    const next = draft.requirements.filter((row) => row.key !== key);
    onChange({ requirements: next.length > 0 ? next : [newRequirementDraft()] });
  };

  const switchKind = (kind: PromoDraft["requirement_kind"]) => {
    onChange({
      requirement_kind: kind,
      requirements: [newRequirementDraft()],
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          "defaultPrices.promos.requirementHint",
          "Customers must add items and quantity specified below to their cart",
        )}
      </p>
      <RadioGroup
        value={draft.requirement_kind}
        onValueChange={(value) => switchKind(value === "category" ? "category" : "item")}
        className="flex flex-wrap gap-4"
      >
        <label className="flex cursor-pointer items-center gap-2">
          <RadioGroupItem value="item" />
          <span className="text-sm">{t("defaultPrices.promos.requirementItem", "Item")}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <RadioGroupItem value="category" />
          <span className="text-sm">
            {t("defaultPrices.promos.requirementCategory", "Any item from a category")}
          </span>
        </label>
      </RadioGroup>

      <div className="space-y-3">
        {draft.requirements.map((row) => (
          <div key={row.key} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={row.quantity}
                onChange={(e) => updateRow(row.key, { quantity: e.target.value.replace(/[^\d]/g, "") })}
                placeholder={t("defaultPrices.promos.qty", "Qty")}
                className="h-9 w-20"
              />
              <span className="text-sm text-muted-foreground">{t("defaultPrices.promos.of", "of")}</span>
              {draft.requirement_kind === "item" ? (
                <Select
                  value={row.product_id || undefined}
                  onValueChange={(value) => updateRow(row.key, { product_id: value, category_id: "" })}
                >
                  <SelectTrigger className="h-9 min-w-0 flex-1">
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
              ) : (
                <Select
                  value={row.category_id || undefined}
                  onValueChange={(value) => updateRow(row.key, { category_id: value, product_id: "" })}
                >
                  <SelectTrigger className="h-9 min-w-0 flex-1">
                    <SelectValue placeholder={t("defaultPrices.promos.selectCategory", "Select category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => removeRow(row.key)}
              >
                <CircleX className="h-5 w-5" />
              </Button>
            </div>
            {draft.requirement_kind === "item" ? (
              <Select disabled value="all">
                <SelectTrigger className="h-9 w-full sm:ml-[5.5rem] sm:w-[calc(100%-7.5rem)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("defaultPrices.promos.allVariants", "All variants")}
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ))}
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={() => onChange({ requirements: [...draft.requirements, newRequirementDraft()] })}
      >
        {draft.requirement_kind === "item"
          ? t("defaultPrices.promos.addItem", "Add Item")
          : t("defaultPrices.promos.addCategory", "Add Category")}
      </Button>

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
