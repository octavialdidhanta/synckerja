import { useEffect, useState } from "react";
import { CircleHelp, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatIdIntegerGrouping, parseGroupedIdInteger, stripToDigits } from "../../utils/formatIdUnitPrice";
import { useCatalogModifierGroups } from "../hooks/useCatalogModifierGroups";
import {
  applyModifierMax,
  applyModifierMin,
  isModifierLimitValid,
  normalizeModifierLimit,
} from "../lib/modifierLimit";
import { parseModifierStockQty, validateModifierStockDrafts } from "../lib/modifierStockDraft";
import type { CatalogModifierGroup } from "../types";
import { ModifierOutletsSection } from "./ModifierOutletsSection";
import { ModifierSelectedCountRow } from "./ModifierSelectedCountRow";
import { ModifierStockSection } from "./stock";

type DraftOption = {
  key: string;
  id?: string;
  name: string;
  priceDisplay: string;
  stock_ingredient_id: string | null;
  stock_qty_display: string;
};

function emptyOption(): DraftOption {
  return {
    key: crypto.randomUUID(),
    name: "",
    priceDisplay: "",
    stock_ingredient_id: null,
    stock_qty_display: "",
  };
}

export type ModifierGroupFormSheetProps = {
  group: CatalogModifierGroup | null;
  selectedOutletId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-0 bg-gray-800 text-white">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function ModifierGroupFormSheet({
  group,
  selectedOutletId,
  open,
  onOpenChange,
}: ModifierGroupFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogModifierGroups();

  const [name, setName] = useState("");
  const [options, setOptions] = useState<DraftOption[]>([emptyOption()]);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [minSelected, setMinSelected] = useState(0);
  const [maxSelected, setMaxSelected] = useState(1);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [removeTarget, setRemoveTarget] = useState<DraftOption | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (group) {
      setName(group.name);
      setOptions(
        group.options.length > 0
          ? group.options.map((opt) => ({
              key: opt.id,
              id: opt.id,
              name: opt.name,
              priceDisplay: opt.extra_price
                ? formatIdIntegerGrouping(String(Math.round(opt.extra_price)))
                : "",
              stock_ingredient_id: opt.stock_ingredient_id,
              stock_qty_display:
                opt.stock_quantity != null && opt.stock_quantity > 0
                  ? String(opt.stock_quantity)
                  : "",
            }))
          : [emptyOption()],
      );
      setLimitEnabled(group.limit_enabled);
      setIsRequired(group.is_required);
      {
        const limit = normalizeModifierLimit({
          limitEnabled: group.limit_enabled,
          isRequired: group.is_required,
          minSelected: group.min_selected,
          maxSelected: group.max_selected,
        });
        setMinSelected(limit.min);
        setMaxSelected(limit.max);
      }
      setStockEnabled(group.stock_enabled);
      setOutletIds([...(group.outlet_ids ?? [])]);
    } else {
      setName("");
      setOptions([emptyOption()]);
      setLimitEnabled(false);
      setIsRequired(false);
      setMinSelected(0);
      setMaxSelected(1);
      setStockEnabled(false);
      setOutletIds(selectedOutletId ? [selectedOutletId] : []);
    }
  }, [open, group, selectedOutletId]);

  const title = group
    ? t("defaultPrices.modifiers.editTitle", "Edit modifier")
    : t("defaultPrices.modifiers.addTitle", "New modifier");

  const updateOption = (key: string, patch: Partial<DraftOption>) => {
    setOptions((prev) => prev.map((opt) => (opt.key === key ? { ...opt, ...patch } : opt)));
  };

  const requestRemoveOption = (opt: DraftOption) => {
    if (options.length <= 1) return;
    if (opt.id) {
      setRemoveTarget(opt);
      return;
    }
    setOptions((prev) => prev.filter((row) => row.key !== opt.key));
  };

  const confirmRemoveOption = () => {
    if (!removeTarget) return;
    setOptions((prev) => prev.filter((row) => row.key !== removeTarget.key));
    setRemoveTarget(null);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("defaultPrices.modifiers.nameRequired", "Enter a modifier group name."),
        variant: "destructive",
      });
      return;
    }
    const mapped = options
      .map((opt) => ({
        id: opt.id,
        name: opt.name.trim(),
        extra_price: (() => {
          const n = parseGroupedIdInteger(opt.priceDisplay);
          return Number.isNaN(n) ? 0 : n;
        })(),
        inventory_sku_id: null as string | null,
        stock_ingredient_id: opt.stock_ingredient_id,
        stock_quantity: parseModifierStockQty(opt.stock_qty_display),
      }))
      .filter((opt) => opt.name);
    if (mapped.length === 0) {
      toast({
        title: t("defaultPrices.modifiers.optionsRequired", "Add at least one modifier option."),
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
    if (
      !isModifierLimitValid({
        limitEnabled,
        isRequired,
        minSelected,
        maxSelected,
      })
    ) {
      toast({
        title: t(
          "defaultPrices.modifiers.limitInvalid",
          "Min cannot be greater than max, and required groups need at least 1.",
        ),
        variant: "destructive",
      });
      return;
    }
    const stockCheck = validateModifierStockDrafts(
      stockEnabled,
      options.map((opt) => ({
        key: opt.key,
        optionName: opt.name,
        ingredientId: opt.stock_ingredient_id,
        quantityDisplay: opt.stock_qty_display,
      })),
    );
    if (!stockCheck.ok) {
      toast({
        title: t(
          "defaultPrices.modifiers.stockIncomplete",
          "Link an ingredient and quantity for every option when Modifier Stock is on.",
        ),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await save({
        id: group?.id,
        name: trimmed,
        limit_enabled: limitEnabled,
        is_required: isRequired,
        min_selected: minSelected,
        max_selected: maxSelected,
        stock_enabled: stockEnabled,
        options: mapped,
        outlet_ids: outletIds,
      });
      toast({ title: t("defaultPrices.modifiers.saved", "Modifier saved.") });
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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          aria-describedby={undefined}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <TooltipProvider delayDuration={200}>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
              <section className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("defaultPrices.modifiers.groupSection", "Modifier group")}
                </p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("defaultPrices.modifiers.namePlaceholder", "Name")}
                />
              </section>

              <ModifierOutletsSection selectedIds={outletIds} onChange={setOutletIds} />

              <section className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("defaultPrices.modifiers.optionsSection", "Modifier options")}
                </p>
                <div className="grid grid-cols-[1fr_96px_32px] gap-2 text-xs text-muted-foreground">
                  <span>{t("defaultPrices.modifiers.optionName", "Option Name")}</span>
                  <span>{t("defaultPrices.modifiers.optionPrice", "Price")}</span>
                  <span />
                </div>
                {options.map((opt) => (
                  <div key={opt.key} className="grid grid-cols-[1fr_96px_32px] items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={(e) => updateOption(opt.key, { name: e.target.value })}
                      placeholder={t("defaultPrices.modifiers.namePlaceholder", "Name")}
                    />
                    <Input
                      inputMode="numeric"
                      value={opt.priceDisplay}
                      onChange={(e) => {
                        const digits = stripToDigits(e.target.value);
                        updateOption(opt.key, {
                          priceDisplay: digits ? formatIdIntegerGrouping(digits) : "",
                        });
                      }}
                      placeholder={t("defaultPrices.modifiers.pricePlaceholder", "Rp")}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      disabled={options.length <= 1}
                      onClick={() => requestRemoveOption(opt)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" className="w-full" onClick={() => setOptions((prev) => [...prev, emptyOption()])}>
                  {t("defaultPrices.modifiers.addOption", "Add Modifier Options")}
                </Button>
              </section>

              <section className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("defaultPrices.modifiers.limitSection", "Modifier limit")}
                    </p>
                    <InfoTip
                      text={t(
                        "defaultPrices.modifiers.limitTooltip",
                        "If activated, you can set whether this modifier is required and the maximum number of options customers can select (online orders and POS).",
                      )}
                    />
                  </div>
                  <Switch checked={limitEnabled} onCheckedChange={setLimitEnabled} />
                </div>
                {limitEnabled ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "defaultPrices.modifiers.limitOnlineNote",
                        "This limit applies to online orders and the POS cashier when customizing an item.",
                      )}
                    </p>
                    <div>
                      <div className="mb-2 flex items-center gap-1.5">
                        <Label>
                          {t("defaultPrices.modifiers.requiredLabel", "Required?")}
                          <span className="text-destructive"> *</span>
                        </Label>
                        <InfoTip
                          text={t(
                            "defaultPrices.modifiers.requiredTooltip",
                            "Control whether customers must select this modifier in online orders and on POS.",
                          )}
                        />
                      </div>
                      <RadioGroup
                        value={isRequired ? "yes" : "no"}
                        onValueChange={(value) => {
                          const nextRequired = value === "yes";
                          setIsRequired(nextRequired);
                          if (nextRequired) {
                            const next = applyModifierMin({
                              minSelected: Math.max(1, minSelected),
                              maxSelected,
                            });
                            setMinSelected(next.min);
                            setMaxSelected(next.max);
                          } else {
                            setMinSelected(0);
                          }
                        }}
                        className="gap-3"
                      >
                        <label className="flex items-start gap-2">
                          <RadioGroupItem value="no" className="mt-0.5" />
                          <span>
                            <span className="block text-sm">{t("defaultPrices.modifiers.requiredNo", "No")}</span>
                            <span className="block text-xs text-muted-foreground">
                              {t("defaultPrices.modifiers.requiredNoHint", "Modifier is optional")}
                            </span>
                          </span>
                        </label>
                        <label className="flex items-start gap-2">
                          <RadioGroupItem value="yes" className="mt-0.5" />
                          <span>
                            <span className="block text-sm">{t("defaultPrices.modifiers.requiredYes", "Yes")}</span>
                            <span className="block text-xs text-muted-foreground">
                              {t("defaultPrices.modifiers.requiredYesHint", "Modifier selection is required")}
                            </span>
                          </span>
                        </label>
                      </RadioGroup>
                    </div>
                    {isRequired ? (
                      <ModifierSelectedCountRow
                        label={t(
                          "defaultPrices.modifiers.minSelected",
                          "Min. number of modifier selected",
                        )}
                        value={minSelected}
                        onChange={(n) => {
                          const next = applyModifierMin({
                            minSelected: n,
                            maxSelected,
                          });
                          setMinSelected(next.min);
                          setMaxSelected(next.max);
                        }}
                      />
                    ) : null}
                    <ModifierSelectedCountRow
                      label={t("defaultPrices.modifiers.maxSelected", "Max. number of modifier selected")}
                      value={maxSelected}
                      onChange={(n) => {
                        const next = applyModifierMax({
                          minSelected,
                          maxSelected: n,
                          isRequired,
                        });
                        setMinSelected(next.min);
                        setMaxSelected(next.max);
                      }}
                    />
                  </div>
                ) : null}
              </section>

              <ModifierStockSection
                stockEnabled={stockEnabled}
                onStockEnabledChange={setStockEnabled}
                rows={options.map((opt) => ({
                  key: opt.key,
                  optionName: opt.name,
                  ingredientId: opt.stock_ingredient_id,
                  quantityDisplay: opt.stock_qty_display,
                }))}
                onRowChange={(key, patch) => {
                  setOptions((prev) =>
                    prev.map((opt) => {
                      if (opt.key !== key) return opt;
                      return {
                        ...opt,
                        ...(patch.ingredientId !== undefined
                          ? { stock_ingredient_id: patch.ingredientId }
                          : {}),
                        ...(patch.quantityDisplay !== undefined
                          ? { stock_qty_display: patch.quantityDisplay }
                          : {}),
                      };
                    }),
                  );
                }}
              />
            </div>
          </TooltipProvider>
          <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={busy}>
              {t("common.save", "Save")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={removeTarget != null} onOpenChange={(next) => !next && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("defaultPrices.modifiers.deleteOptionTitle", "Delete option?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("defaultPrices.modifiers.deleteOptionBody", "Delete {{name}}?", {
                name: removeTarget?.name || t("defaultPrices.modifiers.optionName", "Option Name"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveOption}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
