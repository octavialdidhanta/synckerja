import { useEffect, useState } from "react";
import { CircleHelp, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
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
import { cn } from "@/shared/lib/utils";
import { refreshNativeSafeAreaChromeInsets } from "@/shared/hooks/useNativeSafeAreaCssVars";
import {
  POS_PANEL,
  POS_SHEET_MOTION,
  POS_SHEET_OVERLAY_MOTION,
} from "@/pos-mobile/shared/lib/posPanelChrome";
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
  /** Called with saved group id after successful create/update. */
  onSaved?: (groupId: string) => void;
  /** POS create-item: cover the parent page, no black sheet overlay. */
  chrome?: "default" | "pos";
};

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-slate-400 hover:text-slate-700">
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
  onSaved,
  chrome = "default",
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
    refreshNativeSafeAreaChromeInsets();
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
      const groupId = await save({
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
      onSaved?.(groupId);
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
        {posChrome ? (
          <h1 className={cn(POS_PANEL.headerTitle, "text-center leading-none")}>{title}</h1>
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
          {t("common.save", "Save")}
        </button>
      </div>
    </div>
  );

  const formBody = (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
              <div className={POS_PANEL.body}>
                <p className={cn(POS_PANEL.sectionTitle, "first:pt-0")}>
                  {t("defaultPrices.modifiers.groupSection", "Modifier group")}
                </p>
                <div className={cn(POS_PANEL.card, "mb-1")}>
                  <div className={POS_PANEL.formRow}>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("defaultPrices.modifiers.namePlaceholder", "Name")}
                      className={POS_PANEL.formInput}
                      disabled={busy}
                    />
                  </div>
                </div>

                <ModifierOutletsSection selectedIds={outletIds} onChange={setOutletIds} />

                <p className={POS_PANEL.sectionTitle}>
                  {t("defaultPrices.modifiers.optionsSection", "Modifier options")}
                </p>
                <div className="mb-1 space-y-2">
                  {options.map((opt) => (
                    <div key={opt.key} className={POS_PANEL.card}>
                      <div className={POS_PANEL.formRow}>
                        <Input
                          value={opt.name}
                          onChange={(e) => updateOption(opt.key, { name: e.target.value })}
                          placeholder={t("defaultPrices.modifiers.optionName", "Option Name")}
                          className={POS_PANEL.formInput}
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                          disabled={busy || options.length <= 1}
                          onClick={() => requestRemoveOption(opt)}
                          aria-label={t("common.delete", "Delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className={POS_PANEL.formRow}>
                        <span className={POS_PANEL.rowLabel}>
                          {t("defaultPrices.modifiers.optionPrice", "Price")}
                        </span>
                        <div className="relative min-w-0 max-w-[55%] flex-1">
                          <span className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                            Rp
                          </span>
                          <Input
                            inputMode="numeric"
                            value={opt.priceDisplay}
                            onChange={(e) => {
                              const digits = stripToDigits(e.target.value);
                              updateOption(opt.key, {
                                priceDisplay: digits ? formatIdIntegerGrouping(digits) : "",
                              });
                            }}
                            placeholder="0"
                            className={cn(POS_PANEL.formInput, "pl-9 text-right")}
                            disabled={busy}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mb-1 h-11 w-full border-slate-200 bg-white text-sm font-semibold text-slate-800"
                  onClick={() => setOptions((prev) => [...prev, emptyOption()])}
                  disabled={busy}
                >
                  {t("defaultPrices.modifiers.addOption", "Add Modifier Options")}
                </Button>

                <p className={POS_PANEL.sectionTitle}>
                  <span className="inline-flex items-center gap-1.5">
                    {t("defaultPrices.modifiers.limitSection", "Modifier limit")}
                    <InfoTip
                      text={t(
                        "defaultPrices.modifiers.limitTooltip",
                        "If activated, you can set whether this modifier is required and the maximum number of options customers can select (online orders and POS).",
                      )}
                    />
                  </span>
                </p>
                <div className={cn(POS_PANEL.card, "mb-1")}>
                  <div className={POS_PANEL.row}>
                    <span className={POS_PANEL.rowLabel}>
                      {t("defaultPrices.modifiers.limitSection", "Modifier limit")}
                    </span>
                    <Switch
                      checked={limitEnabled}
                      onCheckedChange={setLimitEnabled}
                      disabled={busy}
                    />
                  </div>
                  {limitEnabled ? (
                    <>
                      <div className={cn(POS_PANEL.row, "items-start")}>
                        <p className="text-xs leading-relaxed text-slate-500">
                          {t(
                            "defaultPrices.modifiers.limitOnlineNote",
                            "This limit applies to online orders and the POS cashier when customizing an item.",
                          )}
                        </p>
                      </div>
                      <div className={cn(POS_PANEL.formRow, "flex-col items-stretch gap-3")}>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm text-slate-800">
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
                          disabled={busy}
                        >
                          <label className="flex items-start gap-2">
                            <RadioGroupItem value="no" className="mt-0.5" />
                            <span>
                              <span className="block text-sm text-slate-800">
                                {t("defaultPrices.modifiers.requiredNo", "No")}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {t("defaultPrices.modifiers.requiredNoHint", "Modifier is optional")}
                              </span>
                            </span>
                          </label>
                          <label className="flex items-start gap-2">
                            <RadioGroupItem value="yes" className="mt-0.5" />
                            <span>
                              <span className="block text-sm text-slate-800">
                                {t("defaultPrices.modifiers.requiredYes", "Yes")}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {t(
                                  "defaultPrices.modifiers.requiredYesHint",
                                  "Modifier selection is required",
                                )}
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
                        label={t(
                          "defaultPrices.modifiers.maxSelected",
                          "Max. number of modifier selected",
                        )}
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
                    </>
                  ) : null}
                </div>

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
                {!posChrome ? <div aria-hidden className="safe-area-bottom" /> : null}
              </div>
            </div>
          </TooltipProvider>
  );

  const panel = (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-100">
      {headerBar}
      {formBody}
    </div>
  );

  return (
    <>
      {posChrome ? (
        open ? (
          <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-slate-100">
            {panel}
          </div>
        ) : null
      ) : (
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
      )}
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
