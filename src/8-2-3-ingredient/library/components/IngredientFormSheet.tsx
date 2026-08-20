import { useEffect, useMemo, useState } from "react";
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
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogIngredients } from "../hooks/useCatalogIngredients";
import { uploadCatalogIngredientPhoto } from "../lib/catalogIngredientPhoto";
import { ingredientInitials } from "../lib/ingredientInitials";
import { formatIngredientStockQty } from "../lib/ingredientStockStatus";
import { DEFAULT_INGREDIENT_UNIT_CODE } from "../lib/ingredientUnits";
import { stockForOutlet, type CatalogIngredient } from "../types";
import { useCatalogIngredientCategories } from "../../categories/hooks/useCatalogIngredientCategories";
import { IngredientPhotoPicker } from "./IngredientPhotoPicker";
import { IngredientUnitSelect } from "./IngredientUnitSelect";
import { ManageIngredientCogsDialog, type CogsDraft } from "./ManageIngredientCogsDialog";
import { ManageIngredientInventoryDialog, type InventoryDraft } from "./ManageIngredientInventoryDialog";

export type IngredientFormSheetProps = {
  ingredient: CatalogIngredient | null;
  selectedOutletId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function toStockDisplay(value: number): string {
  return value ? formatIngredientStockQty(value) : "";
}

const UNCATEGORIZED_VALUE = "__uncategorized__";

export function IngredientFormSheet({
  ingredient,
  selectedOutletId,
  open,
  onOpenChange,
}: IngredientFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { save, remove, isSaving } = useCatalogIngredients();
  const { rows: categoryRows } = useCatalogIngredientCategories();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(UNCATEGORIZED_VALUE);
  const [unitCode, setUnitCode] = useState(DEFAULT_INGREDIENT_UNIT_CODE);
  const [trackInventory, setTrackInventory] = useState(false);
  const [inStock, setInStock] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertAt, setAlertAt] = useState("");
  const [trackCogs, setTrackCogs] = useState(false);
  const [avgCost, setAvgCost] = useState("");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [cogsOpen, setCogsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);

  const lockTracking = Boolean(ingredient?.track_inventory);

  useEffect(() => {
    if (!open) return;
    if (ingredient) {
      const stock = stockForOutlet(ingredient, selectedOutletId);
      setName(ingredient.name);
      setCategoryId(ingredient.category_id ?? UNCATEGORIZED_VALUE);
      setUnitCode(ingredient.unit_code || DEFAULT_INGREDIENT_UNIT_CODE);
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
      setTrackInventory(false);
      setInStock("");
      setAlertEnabled(false);
      setAlertAt("");
      setTrackCogs(false);
      setAvgCost("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setExistingPhotoPath(null);
    }
    setInventoryOpen(false);
    setCogsOpen(false);
  }, [open, ingredient, selectedOutletId]);

  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

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
  const isEdit = Boolean(ingredient);
  const title = isEdit
    ? t("ingredient.library.editRawTitle", "Edit Raw Ingredient")
    : t("ingredient.library.createRawTitle", "Create Raw Ingredient");

  const inventoryDraft: InventoryDraft = {
    trackStock: trackInventory,
    inStock,
    alertEnabled,
    alertAt,
  };
  const cogsDraft: CogsDraft = { trackCogs, avgCost };

  const handleSave = async () => {
    if (!nameValid) {
      toast({
        title: t("ingredient.library.nameRequired", "Enter an ingredient name."),
        variant: "destructive",
      });
      return;
    }
    if (!selectedOutletId) {
      toast({
        title: t("ingredient.library.outletRequired", "Select an outlet first."),
        variant: "destructive",
      });
      return;
    }
    if (!organizationId) return;
    const stockValue = Number(inStock);
    if (trackInventory && !(inStock.trim().length > 0 && Number.isFinite(stockValue) && stockValue >= 0)) {
      toast({
        title: t("ingredient.library.stockRequired", "Enter a valid in-stock quantity."),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const draftId = ingredient?.id ?? crypto.randomUUID();
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
          return;
        }
      }
      await save({
        id: draftId,
        name: name.trim(),
        kind: "raw",
        category_id: categoryId === UNCATEGORIZED_VALUE ? null : categoryId,
        unit_code: unitCode,
        track_inventory: lockTracking || trackInventory,
        outlet_id: selectedOutletId,
        in_stock: Number.isFinite(stockValue) ? stockValue : 0,
        alert_enabled: alertEnabled,
        alert_at: alertAt.trim() ? Number(alertAt) : null,
        track_cogs: trackCogs,
        avg_cost: Number(avgCost) || 0,
        photo_path: photoPath,
      });
      toast({ title: t("ingredient.library.saved", "Ingredient saved.") });
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

  const busy = saving || isSaving;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
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
                  placeholder={t("ingredient.library.namePlaceholder", "Ingredient name")}
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
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("ingredient.library.unitSection", "Unit")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("ingredient.library.unitHint", "Unit in stock (e.g Litre, Kg, Pieces, etc)")}
            </p>
            <IngredientUnitSelect value={unitCode} onChange={setUnitCode} />
          </section>

          <section className="space-y-3">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("ingredient.library.inventorySection", "Inventory")}
            </p>
            {trackInventory ? (
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
              onClick={() => {
                if (!trackInventory) setTrackInventory(true);
                setInventoryOpen(true);
              }}
            >
              {trackInventory
                ? t("ingredient.library.manageInventory", "Manage Ingredient Inventory and Alerts")
                : t("ingredient.library.startInventory", "Start Tracking Ingredient Inventory and Alerts")}
            </Button>
            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              {t(
                "ingredient.library.inventoryImmutable",
                "Ingredient stock is automatically tracked and can not be changed after saving the item, so please make sure that it is correct!",
              )}
            </p>
          </section>

          <section className="space-y-3">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("ingredient.library.costSection", "Cost")}
            </p>
            {trackInventory && trackCogs ? (
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
              disabled={!trackInventory}
              onClick={() => {
                if (!trackCogs) setTrackCogs(true);
                setCogsOpen(true);
              }}
            >
              {trackCogs
                ? t("ingredient.library.manageCogs", "Manage Cost of Good Sold (COGS)")
                : t("ingredient.library.startCogs", "Start Tracking Cost of Goods Sold (COGS)")}
            </Button>
            {trackInventory ? (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t(
                  "ingredient.library.cogsImmutable",
                  "Avg cost can not be changed after saving the item, so please make sure that it is correct!",
                )}
              </p>
            ) : (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                {t(
                  "ingredient.library.cogsLocked",
                  "This ingredient can not be tracked because the inventory stock is not tracked.",
                )}
              </p>
            )}
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
        onConfirm={(next) => {
          setTrackCogs(next.trackCogs);
          setAvgCost(next.avgCost);
        }}
      />
    </Sheet>
  );
}
