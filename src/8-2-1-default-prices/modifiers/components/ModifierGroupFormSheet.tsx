import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Minus, Plus, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
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
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useInventorySkusQuery } from "@/stock-management/hooks/useInventorySkusQuery";
import { createInventorySku } from "@/stock-management/lib/inventoryApi";
import { formatIdIntegerGrouping, parseGroupedIdInteger, stripToDigits } from "../../utils/formatIdUnitPrice";
import { useCatalogModifierGroups } from "../hooks/useCatalogModifierGroups";
import type { CatalogModifierGroup } from "../types";
import { ModifierOutletsSection } from "./ModifierOutletsSection";

type DraftOption = {
  key: string;
  id?: string;
  name: string;
  priceDisplay: string;
  inventory_sku_id: string;
};

function emptyOption(): DraftOption {
  return {
    key: crypto.randomUUID(),
    name: "",
    priceDisplay: "",
    inventory_sku_id: "",
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
  const { organizationId } = useCurrentOrg();
  const { save, isSaving } = useCatalogModifierGroups();
  const skusQuery = useInventorySkusQuery(organizationId);
  const skuRows = skusQuery.data?.rows ?? [];

  const [name, setName] = useState("");
  const [options, setOptions] = useState<DraftOption[]>([emptyOption()]);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [maxSelected, setMaxSelected] = useState(1);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [skuDraft, setSkuDraft] = useState({ optionKey: "", code: "", qty: "0" });
  const [creatingSku, setCreatingSku] = useState(false);
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
              priceDisplay: opt.extra_price ? formatIdIntegerGrouping(String(Math.round(opt.extra_price))) : "",
              inventory_sku_id: opt.inventory_sku_id ?? "",
            }))
          : [emptyOption()],
      );
      setLimitEnabled(group.limit_enabled);
      setIsRequired(group.is_required);
      setMaxSelected(Math.max(1, group.max_selected));
      setStockEnabled(group.stock_enabled);
      setOutletIds([...(group.outlet_ids ?? [])]);
    } else {
      setName("");
      setOptions([emptyOption()]);
      setLimitEnabled(false);
      setIsRequired(false);
      setMaxSelected(1);
      setStockEnabled(false);
      setOutletIds(selectedOutletId ? [selectedOutletId] : []);
    }
    setSkuDraft({ optionKey: "", code: "", qty: "0" });
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

  const handleCreateSku = async (optionKey: string) => {
    if (!organizationId || !skuDraft.code.trim()) return;
    setCreatingSku(true);
    try {
      const created = await createInventorySku(organizationId, {
        internal_sku: skuDraft.code.trim(),
        name: skuDraft.code.trim(),
        product_name: skuDraft.code.trim(),
        initial_qty: Math.max(0, Math.floor(Number(skuDraft.qty) || 0)),
        unit: "pcs",
      });
      updateOption(optionKey, { inventory_sku_id: created.sku_id });
      setSkuDraft({ optionKey: "", code: "", qty: "0" });
      await skusQuery.refetch();
    } catch {
      toast({
        title: t("defaultPrices.product.skuCreateFailed", "Could not create SKU."),
        variant: "destructive",
      });
    } finally {
      setCreatingSku(false);
    }
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
        inventory_sku_id: stockEnabled ? opt.inventory_sku_id || null : null,
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
    setSaving(true);
    try {
      await save({
        id: group?.id,
        name: trimmed,
        limit_enabled: limitEnabled,
        is_required: isRequired,
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
  const skuSelectValue = useMemo(() => skuRows, [skuRows]);

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
                  <div key={opt.key} className="space-y-2">
                    <div className="grid grid-cols-[1fr_96px_32px] items-center gap-2">
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
                    {stockEnabled ? (
                      <div className="space-y-2 rounded-md border p-2">
                        <Select
                          value={opt.inventory_sku_id || undefined}
                          onValueChange={(value) => updateOption(opt.key, { inventory_sku_id: value })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder={t("defaultPrices.product.skuPlaceholder", "Select SKU")} />
                          </SelectTrigger>
                          <SelectContent>
                            {skuSelectValue.map((row) => (
                              <SelectItem key={row.id} value={row.id}>
                                {row.internal_sku} · {row.name} ({row.available_qty})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            placeholder={t("defaultPrices.product.skuCode", "SKU code")}
                            value={skuDraft.optionKey === opt.key ? skuDraft.code : ""}
                            onChange={(e) =>
                              setSkuDraft({ optionKey: opt.key, code: e.target.value, qty: skuDraft.qty })
                            }
                          />
                          <Input
                            className="w-20"
                            inputMode="numeric"
                            placeholder="0"
                            value={skuDraft.optionKey === opt.key ? skuDraft.qty : "0"}
                            onChange={(e) =>
                              setSkuDraft({
                                optionKey: opt.key,
                                code: skuDraft.optionKey === opt.key ? skuDraft.code : "",
                                qty: e.target.value,
                              })
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={creatingSku}
                            onClick={() => void handleCreateSku(opt.key)}
                          >
                            {t("defaultPrices.product.createSku", "Create")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
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
                        "(Online order only) If activated, you can set a limit of minimum or maximum number when selecting this modifier.",
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
                        "This configuration is applied only to online order users and will not be reflected on the POS.",
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
                            "Set modifier configuration to control how customers select modifiers in online orders.",
                          )}
                        />
                      </div>
                      <RadioGroup
                        value={isRequired ? "yes" : "no"}
                        onValueChange={(value) => setIsRequired(value === "yes")}
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
                    <div className="flex items-center justify-between gap-2">
                      <Label>{t("defaultPrices.modifiers.maxSelected", "Max. number of modifier selected")}</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setMaxSelected((n) => Math.max(1, n - 1))}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          className="h-8 w-14 text-center"
                          inputMode="numeric"
                          value={String(maxSelected)}
                          onChange={(e) => {
                            const n = parseInt(stripToDigits(e.target.value) || "1", 10);
                            setMaxSelected(Number.isFinite(n) ? Math.max(1, n) : 1);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setMaxSelected((n) => n + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("defaultPrices.modifiers.stockSection", "Modifier stock")}
                    </p>
                    <InfoTip
                      text={t(
                        "defaultPrices.modifiers.stockTooltip",
                        "If activated, you can track ingredient stock used in the modifier options and monitor it in the inventory summary.",
                      )}
                    />
                  </div>
                  <Switch checked={stockEnabled} onCheckedChange={setStockEnabled} />
                </div>
              </section>
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
