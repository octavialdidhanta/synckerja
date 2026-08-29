import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Info, Lock, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogIngredientCategories } from "../../categories/hooks/useCatalogIngredientCategories";
import { ManageRecipeDialog } from "../../recipes/components/ManageRecipeDialog";
import { ProduceStockDialog } from "../../recipes/production/components/ProduceStockDialog";
import { useCatalogIngredientRecipes } from "../../recipes/hooks/useCatalogIngredientRecipes";
import { isRecipeDraftComplete } from "../../recipes/lib/recipeCompleteness";
import { emptyRecipeDraft, type RecipeDraft } from "../../recipes/types";
import { recipeUnitAvgCost } from "../../product-recipes/lib/productRecipeCost";
import { useCatalogIngredients } from "../hooks/useCatalogIngredients";
import { uploadCatalogIngredientPhoto } from "../lib/catalogIngredientPhoto";
import { ingredientInitials } from "../lib/ingredientInitials";
import { formatIngredientStockQty } from "../lib/ingredientStockStatus";
import { DEFAULT_INGREDIENT_UNIT_CODE } from "../lib/ingredientUnits";
import { stockForOutlet, type CatalogIngredient } from "../types";
import { IngredientPhotoPicker } from "./IngredientPhotoPicker";
import { IngredientUnitSelect } from "./IngredientUnitSelect";
import { ManageIngredientCogsDialog, type CogsDraft } from "./ManageIngredientCogsDialog";
import { ManageIngredientInventoryDialog, type InventoryDraft } from "./ManageIngredientInventoryDialog";

export type SemiFinishedIngredientFormSheetProps = {
  ingredient: CatalogIngredient | null;
  selectedOutletId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function toStockDisplay(value: number): string {
  return value ? formatIngredientStockQty(value) : "";
}

const UNCATEGORIZED_VALUE = "__uncategorized__";

export function SemiFinishedIngredientFormSheet({
  ingredient,
  selectedOutletId,
  open,
  onOpenChange,
}: SemiFinishedIngredientFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { save, remove, isSaving, rows: ingredientRows } = useCatalogIngredients();
  const recipes = useCatalogIngredientRecipes();
  const recipesRef = useRef(recipes);
  recipesRef.current = recipes;
  const { rows: categoryRows } = useCatalogIngredientCategories();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(UNCATEGORIZED_VALUE);
  const [unitCode, setUnitCode] = useState(DEFAULT_INGREDIENT_UNIT_CODE);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>(emptyRecipeDraft);
  const [trackInventory, setTrackInventory] = useState(false);
  const [inStock, setInStock] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertAt, setAlertAt] = useState("");
  const [trackCogs, setTrackCogs] = useState(false);
  const [avgCost, setAvgCost] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [cogsOpen, setCogsOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [produceOpen, setProduceOpen] = useState(false);
  const [persistedId, setPersistedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [infoTipOpen, setInfoTipOpen] = useState(false);
  const [infoTipReady, setInfoTipReady] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);

  const lockTracking = Boolean(ingredient?.track_inventory);
  const recipeComplete = isRecipeDraftComplete(recipeDraft);

  const ingredientsById = useMemo(() => {
    const map = new Map<string, CatalogIngredient>();
    for (const row of ingredientRows) map.set(row.id, row);
    return map;
  }, [ingredientRows]);

  const resolvedIngredient = useMemo(() => {
    const id = ingredient?.id ?? persistedId;
    if (!id) return null;
    // Prefer live query row so Produce / stock edits refresh IN STOCK without remount.
    return ingredientRows.find((row) => row.id === id) ?? ingredient ?? null;
  }, [ingredient, persistedId, ingredientRows]);

  useEffect(() => {
    if (!open) return;
    const existing = ingredient ? recipesRef.current.byOutputId.get(ingredient.id) : undefined;
    if (ingredient) {
      const stock = stockForOutlet(ingredient, selectedOutletId);
      setName(ingredient.name);
      setCategoryId(ingredient.category_id ?? UNCATEGORIZED_VALUE);
      setUnitCode(ingredient.unit_code || DEFAULT_INGREDIENT_UNIT_CODE);
      setRecipeDraft(
        existing
          ? {
              yieldQty: existing.yield_qty,
              lines: existing.lines.map((line) => ({
                ingredient_id: line.ingredient_id,
                quantity: line.quantity,
              })),
            }
          : emptyRecipeDraft(),
      );
      setTrackInventory(ingredient.track_inventory);
      setInStock(toStockDisplay(stock.in_stock));
      setAlertEnabled(stock.alert_enabled);
      setAlertAt(stock.alert_at == null ? "" : formatIngredientStockQty(stock.alert_at));
      setTrackCogs(stock.track_cogs);
      setAvgCost(stock.avg_cost ? String(Math.round(stock.avg_cost)) : "");
      setPhotoFile(null);
      setPhotoPreview(ingredient.photo_url ?? null);
      setExistingPhotoPath(ingredient.photo_path ?? null);
    } else {
      setName("");
      setCategoryId(UNCATEGORIZED_VALUE);
      setUnitCode(DEFAULT_INGREDIENT_UNIT_CODE);
      setRecipeDraft(emptyRecipeDraft());
      setTrackInventory(false);
      setInStock("");
      setAlertEnabled(false);
      setAlertAt("");
      setTrackCogs(false);
      setAvgCost("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setExistingPhotoPath(null);
      setPersistedId(null);
    }
    if (ingredient?.id) setPersistedId(ingredient.id);
    setInventoryOpen(false);
    setCogsOpen(false);
    setRecipeOpen(false);
    setProduceOpen(false);
    setInfoTipOpen(false);
    setInfoTipReady(false);
  }, [open, ingredient, selectedOutletId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setInfoTipReady(true), 350);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  useEffect(() => {
    if (!open || !ingredient) return;
    const existing = recipes.byOutputId.get(ingredient.id);
    if (!existing) return;
    setRecipeDraft((prev) => {
      if (prev.yieldQty > 0 || prev.lines.length > 0) return prev;
      return {
        yieldQty: existing.yield_qty,
        lines: existing.lines.map((line) => ({
          ingredient_id: line.ingredient_id,
          quantity: line.quantity,
        })),
      };
    });
  }, [ingredient, open, recipes.rows]);

  useEffect(() => {
    if (!open || !resolvedIngredient) return;
    const stock = stockForOutlet(resolvedIngredient, selectedOutletId);
    setInStock(toStockDisplay(stock.in_stock));
    setAvgCost(stock.avg_cost ? String(Math.round(stock.avg_cost)) : "");
    setTrackCogs(stock.track_cogs);
    if (resolvedIngredient.track_inventory) setTrackInventory(true);
  }, [open, resolvedIngredient, selectedOutletId]);

  const derivedRecipeAvg = useMemo(
    () =>
      recipeUnitAvgCost(recipeDraft.lines, recipeDraft.yieldQty, ingredientsById, selectedOutletId),
    [recipeDraft.lines, recipeDraft.yieldQty, ingredientsById, selectedOutletId],
  );

  // Backfill COGS from recipe when avg cost is still empty (e.g. recipe saved before this behavior).
  useEffect(() => {
    if (!open || !recipeComplete || derivedRecipeAvg == null) return;
    if (Number(avgCost) > 0) return;
    const stockNum =
      Number(inStock.trim() === "" ? "0" : inStock) ||
      (resolvedIngredient ? stockForOutlet(resolvedIngredient, selectedOutletId).in_stock : 0);
    if (stockNum > 0) return;
    setTrackCogs(true);
    setAvgCost(String(Math.round(derivedRecipeAvg)));
  }, [
    open,
    recipeComplete,
    derivedRecipeAvg,
    avgCost,
    inStock,
    resolvedIngredient,
    selectedOutletId,
  ]);

  const outletCategories = useMemo(() => {
    const forOutlet = categoryRows.filter((row) => (row.outlet_ids ?? []).includes(selectedOutletId));
    const currentId = ingredient?.category_id;
    if (currentId && !forOutlet.some((row) => row.id === currentId)) {
      const extra = categoryRows.find((row) => row.id === currentId);
      if (extra) return [extra, ...forOutlet];
    }
    return forOutlet;
  }, [categoryRows, ingredient?.category_id, selectedOutletId]);

  const nameValid = name.trim().length > 0;
  const initials = ingredientInitials(name);
  const isEdit = Boolean(ingredient ?? resolvedIngredient);
  const canProduce = Boolean(
    nameValid &&
      unitCode.trim() &&
      recipeComplete &&
      trackInventory &&
      selectedOutletId &&
      organizationId,
  );
  const title = isEdit
    ? t("ingredient.semiFinished.editTitle", "Edit Semi-Finished Ingredient")
    : t("ingredient.semiFinished.createTitle", "Create Semi-Finished Ingredient");

  const inventoryDraft: InventoryDraft = {
    trackStock: trackInventory,
    inStock,
    alertEnabled,
    alertAt,
  };
  const cogsDraft: CogsDraft = { trackCogs, avgCost };

  const openRecipe = () => {
    if (!nameValid || !unitCode.trim()) {
      toast({
        title: t(
          "ingredient.semiFinished.recipeNeedsNameUnit",
          "Enter a name and unit before managing the recipe.",
        ),
        variant: "destructive",
      });
      return;
    }
    setRecipeOpen(true);
  };

  const handleRecipeSave = async (next: RecipeDraft) => {
    setRecipeDraft(next);
    const unitCost = recipeUnitAvgCost(next.lines, next.yieldQty, ingredientsById, selectedOutletId);
    const roundedAvg = unitCost != null ? Math.round(unitCost) : null;
    const currentStock =
      Number(inStock.trim() === "" ? "0" : inStock) ||
      (resolvedIngredient ? stockForOutlet(resolvedIngredient, selectedOutletId).in_stock : 0);
    const currentAvg = Number(avgCost) || 0;
    // Seed COGS from recipe on first save / while no stock yet (produce later weights avg).
    const shouldSeedCogs = roundedAvg != null && (currentStock <= 0 || currentAvg <= 0);

    if (roundedAvg != null) {
      setTrackCogs(true);
      if (shouldSeedCogs) setAvgCost(String(roundedAvg));
    }

    const outputId = resolvedIngredient?.id ?? persistedId ?? ingredient?.id;
    if (outputId) {
      await recipes.save({
        outputIngredientId: outputId,
        yieldQty: next.yieldQty,
        lines: next.lines,
      });
    }

    const allowInventory = lockTracking || trackInventory;
    if (outputId && allowInventory && shouldSeedCogs && roundedAvg != null && organizationId && selectedOutletId) {
      const stockRaw = inStock.trim();
      const stockValue = stockRaw === "" ? 0 : Number(stockRaw);
      await save({
        id: outputId,
        name: name.trim() || resolvedIngredient?.name || "—",
        kind: "semi_finished",
        category_id: categoryId === UNCATEGORIZED_VALUE ? null : categoryId,
        unit_code: unitCode,
        track_inventory: true,
        outlet_id: selectedOutletId,
        in_stock: Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : 0,
        alert_enabled: alertEnabled,
        alert_at: alertAt.trim() ? Number(alertAt) : null,
        track_cogs: true,
        avg_cost: roundedAvg,
        photo_path: existingPhotoPath,
      });
    }
  };

  const handleSave = async (opts?: { silent?: boolean }): Promise<string | null | undefined> => {
    if (!nameValid) {
      toast({
        title: t("ingredient.library.nameRequired", "Enter an ingredient name."),
        variant: "destructive",
      });
      return null;
    }
    if (!selectedOutletId) {
      toast({
        title: t("ingredient.library.outletRequired", "Select an outlet first."),
        variant: "destructive",
      });
      return null;
    }
    if (!organizationId) return null;
    const complete = isRecipeDraftComplete(recipeDraft);
    const allowInventory = complete && (lockTracking || trackInventory);
    // Empty opening stock = 0 (Produce will add qty). Only reject invalid/negative input.
    const stockRaw = inStock.trim();
    const stockValue = stockRaw === "" ? 0 : Number(stockRaw);
    if (allowInventory && (!Number.isFinite(stockValue) || stockValue < 0)) {
      toast({
        title: t("ingredient.library.stockRequired", "Enter a valid in-stock quantity."),
        variant: "destructive",
      });
      return null;
    }
    const recipeAvg = derivedRecipeAvg;
    const resolvedAvgCost =
      Number(avgCost) || (recipeAvg != null && allowInventory ? Math.round(recipeAvg) : 0);
    const resolvedTrackCogs =
      allowInventory && (trackCogs || (recipeAvg != null && recipeAvg > 0));
    if (resolvedTrackCogs && recipeAvg != null && !(Number(avgCost) > 0)) {
      setTrackCogs(true);
      setAvgCost(String(Math.round(recipeAvg)));
    }
    setSaving(true);
    try {
      const draftId = ingredient?.id ?? persistedId ?? crypto.randomUUID();
      let photoPath = existingPhotoPath;
      if (photoFile) {
        try {
          photoPath = await uploadCatalogIngredientPhoto({
            organizationId,
            ingredientId: draftId,
            file: photoFile,
          });
        } catch {
          toast({
            title: t("ingredient.library.photoUploadFailed", "Could not upload photo."),
            variant: "destructive",
          });
          return null;
        }
      }
      const ingredientId = await save({
        id: draftId,
        name: name.trim(),
        kind: "semi_finished",
        category_id: categoryId === UNCATEGORIZED_VALUE ? null : categoryId,
        unit_code: unitCode,
        track_inventory: allowInventory,
        outlet_id: selectedOutletId,
        in_stock: stockValue,
        alert_enabled: allowInventory && alertEnabled,
        alert_at: allowInventory && alertAt.trim() ? Number(alertAt) : null,
        track_cogs: resolvedTrackCogs,
        avg_cost: resolvedTrackCogs ? resolvedAvgCost : 0,
        photo_path: photoPath,
      });
      if (complete) {
        await recipes.save({
          outputIngredientId: ingredientId,
          yieldQty: recipeDraft.yieldQty,
          lines: recipeDraft.lines,
        });
      }
      setPersistedId(ingredientId);
      if (stockRaw === "" && allowInventory) setInStock("0");
      if (!opts?.silent) {
        toast({ title: t("ingredient.library.saved", "Ingredient saved.") });
      }
      return ingredientId;
    } catch {
      toast({
        title: t("defaultPrices.form.saveFailed", "Failed to save."),
        variant: "destructive",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleProduceClick = async () => {
    if (!canProduce) return;
    if (!(resolvedIngredient?.id || persistedId)) {
      const id = await handleSave({ silent: true });
      if (!id) return;
    }
    setProduceOpen(true);
  };

  const produceOutput = useMemo((): CatalogIngredient | null => {
    if (resolvedIngredient) return resolvedIngredient;
    if (!persistedId || !organizationId) return null;
    const stockValue = Number(inStock);
    return {
      id: persistedId,
      organization_id: organizationId,
      name: name.trim() || "—",
      kind: "semi_finished",
      category_id: categoryId === UNCATEGORIZED_VALUE ? null : categoryId,
      unit_code: unitCode,
      track_inventory: trackInventory,
      sort_order: 0,
      photo_path: existingPhotoPath,
      photo_url: photoPreview,
      outlet_ids: selectedOutletId ? [selectedOutletId] : [],
      outlet_stocks: selectedOutletId
        ? [
            {
              outlet_id: selectedOutletId,
              in_stock: Number.isFinite(stockValue) ? stockValue : 0,
              alert_enabled: alertEnabled,
              alert_at: alertAt.trim() ? Number(alertAt) : null,
              track_cogs: trackCogs,
              avg_cost: Number(avgCost) || 0,
            },
          ]
        : [],
    };
  }, [
    resolvedIngredient,
    persistedId,
    organizationId,
    name,
    categoryId,
    unitCode,
    trackInventory,
    existingPhotoPath,
    photoPreview,
    selectedOutletId,
    inStock,
    alertEnabled,
    alertAt,
    trackCogs,
    avgCost,
  ]);

  const handleDelete = async () => {
    if (!ingredient) return;
    setSaving(true);
    try {
      await remove(ingredient.id);
      toast({ title: t("ingredient.library.deleted", "Ingredient deleted.") });
      onOpenChange(false);
    } catch {
      toast({
        title: t("ingredient.library.deleteFailed", "Could not delete ingredient."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving || recipes.isSaving;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle className="flex items-center gap-1.5">
            {title}
            <TooltipProvider delayDuration={200}>
              <Tooltip
                open={infoTipOpen && infoTipReady}
                onOpenChange={(next) => {
                  if (infoTipReady) setInfoTipOpen(next);
                }}
              >
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-primary"
                    aria-label={t("common.info", "Info")}
                    onMouseEnter={() => {
                      if (infoTipReady) setInfoTipOpen(true);
                    }}
                    onMouseLeave={() => setInfoTipOpen(false)}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {t(
                    "ingredient.semiFinished.info",
                    "Semi-finished ingredients are made from raw ingredients and used in other recipes. They are not sold directly.",
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="flex items-start gap-3">
            <IngredientPhotoPicker
              photoSrc={photoPreview}
              initials={initials}
              onFileChange={setPhotoFile}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="relative">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("ingredient.library.namePlaceholder", "Ingredient Name")}
                  className={cn(nameValid && "pr-8")}
                />
                {nameValid ? (
                  <Check className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                ) : null}
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("ingredient.library.uncategorized", "Uncategorized")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED_VALUE}>
                    {t("ingredient.library.uncategorized", "Uncategorized")}
                  </SelectItem>
                  {outletCategories.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <section className="space-y-2">
            <p className="border-b pb-2 text-sm font-medium">
              {t("ingredient.semiFinished.unitSection", "Unit of Measurements")}
            </p>
            <IngredientUnitSelect value={unitCode} onChange={setUnitCode} />
            <p className="text-sm text-muted-foreground">
              {t(
                "ingredient.semiFinished.unitHint",
                "Select based on your operational usage (e.g. gram for rice, millilitre for sauces, etc)",
              )}
            </p>
          </section>

          <section className="space-y-3">
            <p className="border-b pb-2 text-sm font-medium">{t("ingredient.recipe.section", "Recipe")}</p>
            <p className="text-sm text-muted-foreground">
              {t("ingredient.recipe.attachHint", "Attach the raw ingredient components.")}
            </p>
            <Button type="button" className="w-full" onClick={openRecipe}>
              {t("ingredient.recipe.manageButton", "Manage Recipe")}
            </Button>
          </section>

          <section className="space-y-3">
            <p className="border-b pb-2 text-sm font-medium">
              {t("ingredient.library.inventorySection", "Inventory")}
            </p>
            {recipeComplete && trackInventory ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{name.trim() || "—"}</span>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("ingredient.library.inStock", "In Stock")}
                  </p>
                  <p>{inStock || "0"}</p>
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={!recipeComplete}
              onClick={() => {
                if (!trackInventory) setTrackInventory(true);
                setInventoryOpen(true);
              }}
            >
              {trackInventory
                ? t("ingredient.library.manageInventory", "Manage Ingredient Inventory and Alerts")
                : t("ingredient.semiFinished.startInventory", "Start Tracking Inventory and Alert")}
            </Button>
            {recipeComplete ? (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t(
                  "ingredient.library.inventoryImmutable",
                  "Ingredient stock is automatically tracked and can not be changed after saving the item, so please make sure that it is correct!",
                )}
              </p>
            ) : (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                {t(
                  "ingredient.semiFinished.inventoryLocked",
                  "Inventory can be tracked after Recipe has been created.",
                )}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <p className="border-b pb-2 text-sm font-medium">
              {t("ingredient.semiFinished.productionSection", "Production")}
            </p>
            <Button
              type="button"
              className="w-full"
              disabled={!canProduce || busy}
              onClick={() => void handleProduceClick()}
            >
              {t("ingredient.semiFinished.produce", "Produce")}
            </Button>
            <p className="flex gap-2 text-xs text-muted-foreground">
              {canProduce ? (
                <>
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {t(
                    "ingredient.semiFinished.produceHint",
                    "Produce stock from the recipe. Raw ingredients will be deducted automatically.",
                  )}
                </>
              ) : (
                <>
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {!recipeComplete
                    ? t(
                        "ingredient.semiFinished.productionLocked",
                        "Production can be used after Recipe has been created.",
                      )
                    : !trackInventory
                      ? t(
                          "ingredient.semiFinished.produceInventoryLocked",
                          "Enable inventory tracking before producing stock.",
                        )
                      : t(
                          "ingredient.semiFinished.produceNeedsName",
                          "Enter a name and unit before producing stock.",
                        )}
                </>
              )}
            </p>
          </section>

          <section className="space-y-3">
            <p className="border-b pb-2 text-sm font-medium">
              {t("ingredient.library.costSection", "Cost")}
            </p>
            {recipeComplete && trackInventory && trackCogs ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{name.trim() || "—"}</span>
                <div className="text-right">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("ingredient.library.avgCost", "Avg Cost")}
                  </p>
                  <p>Rp {avgCost || "0"}</p>
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={!recipeComplete || !trackInventory}
              onClick={() => {
                if (!trackCogs) setTrackCogs(true);
                setCogsOpen(true);
              }}
            >
              {t("ingredient.library.manageCogs", "Manage Cost of Goods Sold (COGS)")}
            </Button>
            <p className="flex gap-2 text-xs text-muted-foreground">
              {recipeComplete ? (
                trackInventory ? (
                  <>
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {t(
                      "ingredient.library.cogsImmutable",
                      "Avg cost can not be changed after saving the item, so please make sure that it is correct!",
                    )}
                  </>
                ) : (
                  <>
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    {t(
                      "ingredient.library.cogsLocked",
                      "This ingredient can not be tracked because the inventory stock is not tracked.",
                    )}
                  </>
                )
              ) : (
                <>
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {t(
                    "ingredient.semiFinished.cogsLocked",
                    "COGS can be tracked after Recipe is created.",
                  )}
                </>
              )}
            </p>
          </section>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-6 py-4">
          {isEdit ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => void handleDelete()}
              disabled={busy}
              aria-label={t("common.delete", "Delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={busy}>
              {t("common.save", "Save")}
            </Button>
          </div>
        </div>
      </SheetContent>
      <ManageRecipeDialog
        open={recipeOpen}
        onOpenChange={setRecipeOpen}
        outputName={name.trim()}
        unitCode={unitCode}
        outputIngredientId={resolvedIngredient?.id ?? ingredient?.id}
        selectedOutletId={selectedOutletId}
        draft={recipeDraft}
        onSave={handleRecipeSave}
      />
      {produceOutput ? (
        <ProduceStockDialog
          open={produceOpen}
          onOpenChange={setProduceOpen}
          outletId={selectedOutletId}
          output={produceOutput}
          recipe={recipeDraft}
          ingredientsById={ingredientsById}
        />
      ) : null}
      <ManageIngredientInventoryDialog
        open={inventoryOpen}
        onOpenChange={setInventoryOpen}
        name={name.trim()}
        unitCode={unitCode}
        value={inventoryDraft}
        lockTracking={lockTracking}
        onConfirm={(next) => {
          setTrackInventory(lockTracking || next.trackStock);
          setInStock(next.inStock);
          setAlertEnabled(next.alertEnabled);
          setAlertAt(next.alertAt);
          if (!(lockTracking || next.trackStock)) {
            setTrackCogs(false);
          }
        }}
      />
      <ManageIngredientCogsDialog
        open={cogsOpen}
        onOpenChange={setCogsOpen}
        name={name.trim()}
        unitCode={unitCode}
        value={cogsDraft}
        hint={t(
          "ingredient.semiFinished.cogsHint",
          "*Avg Cost is calculated from the recipe when you save Manage Recipe",
        )}
        onConfirm={(next) => {
          setTrackCogs(next.trackCogs);
          setAvgCost(next.avgCost);
        }}
      />
    </Sheet>
  );
}
