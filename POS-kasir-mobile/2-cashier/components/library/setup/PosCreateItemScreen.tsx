import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { refreshNativeSafeAreaChromeInsets } from "@/shared/hooks/useNativeSafeAreaCssVars";
import { useDefaultPrices } from "@/8-2-1-default-prices/hooks/useDefaultPrices";
import { uploadCatalogProductPhoto } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { useCatalogProductCategories } from "@/8-2-1-default-prices/categories/hooks/useCatalogProductCategories";
import {
  ModifierGroupFormSheet,
  useCatalogModifierGroups,
} from "@/8-2-1-default-prices/modifiers";
import { formatIdIntegerGrouping } from "@/8-2-1-default-prices/utils/formatIdUnitPrice";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { PosSafeAreaBottomSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaBottomSpacer";
import { usePosKeyboardDock } from "@/pos-mobile/shared/hooks/usePosKeyboardDock";
import { usePosCashierIsPhoneLayout } from "../../../hooks/usePosCashierIsPhoneLayout";
import { PosCameraBarcodeScanDialog } from "../../scanner/PosCameraBarcodeScanDialog";
import { applyScanToSkuField } from "../../../lib/scanner/applyScanToSkuField";
import { POS_CASHIER_I18N } from "../../../lib/posCashierCopy";
import { PosCreateItemSkuField } from "./PosCreateItemSkuField";
import { PosCreateItemVariantsBlock } from "./variants/PosCreateItemVariantsBlock";
import { PosCreateItemModifiersBlock } from "./modifiers/PosCreateItemModifiersBlock";
import { PosPickModifierSetsSheet } from "./modifiers/PosPickModifierSetsSheet";
import { PosCreateItemPhotoField } from "./photo";
import {
  buildPosCreateItemPayload,
  POS_CREATE_ITEM_FORM_EMPTY,
  type PosCreateItemFormState,
} from "./usePosCreateItemForm";

const NONE_CATEGORY = "__none__";

/** Supabase/Postgrest errors are plain objects — not always `instanceof Error`. */
function formatCreateItemError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [o.message, o.details, o.hint, o.code].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    if (parts.length) return parts.join(" — ");
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

type Props = {
  open: boolean;
  outletId: string;
  onClose: () => void;
  onSaved?: () => void;
};

export function PosCreateItemScreen({ open, outletId, onClose, onSaved }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const isPhone = usePosCashierIsPhoneLayout();
  usePosKeyboardDock({
    enabled: open,
    /* Full-screen Create Item: focus scrollIntoView jumps the sheet before IME. */
    scrollIntoView: false,
  });
  const { create } = useDefaultPrices();
  const modifiers = useCatalogModifierGroups();
  const categoriesQuery = useCatalogProductCategories();
  const [form, setForm] = useState<PosCreateItemFormState>(POS_CREATE_ITEM_FORM_EMPTY);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [skuScanOpen, setSkuScanOpen] = useState(false);
  const [variantDialogOpen, setVariantDialogOpen] = useState(false);
  const [pickModifiersOpen, setPickModifiersOpen] = useState(false);
  const [createModifierOpen, setCreateModifierOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    refreshNativeSafeAreaChromeInsets();
  }, [open]);

  useEffect(() => {
    if (open) return;
    setForm(POS_CREATE_ITEM_FORM_EMPTY);
    setPhotoFile(null);
    setVariantDialogOpen(false);
    setPickModifiersOpen(false);
    setCreateModifierOpen(false);
  }, [open]);

  const categories = useMemo(() => {
    const rows = categoriesQuery.rows ?? [];
    if (!outletId) return rows;
    return rows.filter(
      (row) => !row.outlet_ids?.length || row.outlet_ids.includes(outletId),
    );
  }, [categoriesQuery.rows, outletId]);

  const hasVariants = form.variants.length > 0;
  const titleText = t(POS_CASHIER_I18N.setupCreateItem, "Create Item");

  const patch = (partial: Partial<PosCreateItemFormState>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const linkPendingModifiers = async (productId: string) => {
    const ids = [...new Set(form.pendingModifierGroupIds.filter(Boolean))];
    for (const groupId of ids) {
      const group = modifiers.rows.find((row) => row.id === groupId);
      const existing = group?.product_ids ?? [];
      const next = existing.includes(productId) ? existing : [...existing, productId];
      await modifiers.assignProducts({ groupId, productIds: next });
    }
  };

  const onSave = async () => {
    if (!organizationId) return;
    const built = buildPosCreateItemPayload({
      organizationId,
      outletId,
      form,
    });
    if (!built.ok) {
      toast({
        title:
          built.error === "name"
            ? t(POS_CASHIER_I18N.setupNameRequired, "Enter an item name.")
            : built.error === "price"
              ? t(POS_CASHIER_I18N.setupPriceRequired, "Enter a price greater than 0.")
              : t(POS_CASHIER_I18N.setupOutletRequired, "Select an outlet first."),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const productId = built.payload.id!;
      let photoPath: string | null = null;
      if (photoFile) {
        try {
          photoPath = await uploadCatalogProductPhoto({
            organizationId,
            productId,
            file: photoFile,
          });
        } catch (photoErr) {
          toast({
            title: t(POS_CASHIER_I18N.setupPhotoUploadFailed, "Could not upload photo."),
            description: formatCreateItemError(photoErr),
            variant: "destructive",
          });
          return;
        }
      }
      await create({ ...built.payload, photo_path: photoPath });
      try {
        await linkPendingModifiers(productId);
      } catch (linkErr) {
        toast({
          title: t(POS_CASHIER_I18N.setupModifierLinkError, "Item saved, but modifiers could not be linked."),
          description: formatCreateItemError(linkErr),
          variant: "destructive",
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["catalog-modifier-groups", organizationId] });
      void queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
      toast({ title: t(POS_CASHIER_I18N.setupItemSaved, "Item saved.") });
      setForm(POS_CREATE_ITEM_FORM_EMPTY);
      setPhotoFile(null);
      onSaved?.();
      onClose();
    } catch (err) {
      toast({
        title: t(POS_CASHIER_I18N.setupItemSaveError, "Could not save item"),
        description: formatCreateItemError(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const shell = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white">
        <div className={cn(POS_PANEL.header, "border-b-0")}>
          <button
            type="button"
            onClick={onClose}
            className={POS_PANEL.headerBack}
            aria-label={t(POS_CASHIER_I18N.setupClose, "Close")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {isPhone ? (
            <h1 className={cn(POS_PANEL.headerTitle, "leading-none")}>{titleText}</h1>
          ) : (
            <DialogTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
              {titleText}
            </DialogTitle>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className={cn(
              "inline-flex h-10 min-w-[3.75rem] flex-shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold text-primary transition hover:bg-primary/10",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {t(POS_CASHIER_I18N.setupSave, "SAVE")}
          </button>
        </div>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={POS_PANEL.body}>
          <p className={cn(POS_PANEL.sectionTitle, "first:pt-0")}>
            {t(POS_CASHIER_I18N.setupPhoto, "Photo")}
          </p>
          <div className={cn(POS_PANEL.card, "mb-1")}>
            <PosCreateItemPhotoField
              file={photoFile}
              disabled={saving}
              onChange={setPhotoFile}
            />
          </div>

          <p className={POS_PANEL.sectionTitle}>
            {t(POS_CASHIER_I18N.setupDetails, "Details")}
          </p>
          <div className={POS_PANEL.card}>
            <div className={POS_PANEL.formRow}>
              <Input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t(POS_CASHIER_I18N.setupItemName, "Item Name")}
                className={POS_PANEL.formInput}
                disabled={saving}
              />
            </div>

            <div className={POS_PANEL.formRow}>
              <Select
                value={form.categoryId ?? NONE_CATEGORY}
                onValueChange={(value) =>
                  patch({ categoryId: value === NONE_CATEGORY ? null : value })
                }
                disabled={saving}
              >
                <SelectTrigger className={cn(POS_PANEL.formInput, "focus:ring-0")}>
                  <SelectValue placeholder={t(POS_CASHIER_I18N.setupCategory, "Category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY}>
                    {t(POS_CASHIER_I18N.setupNoCategory, "No category")}
                  </SelectItem>
                  {categories.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!hasVariants ? (
              <>
                <div className={POS_PANEL.formRow}>
                  <span className={POS_PANEL.rowLabel}>
                    {t(POS_CASHIER_I18N.setupPrice, "Price")}
                  </span>
                  <Input
                    inputMode="numeric"
                    value={form.priceDisplay}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "");
                      patch({
                        priceDisplay: digits ? formatIdIntegerGrouping(digits) : "",
                      });
                    }}
                    placeholder="0"
                    className={POS_PANEL.formInputEnd}
                    disabled={saving}
                  />
                </div>

                <PosCreateItemSkuField
                  value={form.catalogSku}
                  onChange={(catalogSku) => patch({ catalogSku })}
                  onOpenScan={() => setSkuScanOpen(true)}
                  disabled={saving}
                />
              </>
            ) : null}
          </div>

          <PosCreateItemVariantsBlock
            variants={form.variants}
            dialogOpen={variantDialogOpen}
            onDialogOpenChange={setVariantDialogOpen}
            onVariantsChange={(variants) =>
              patch({
                variants,
                catalogSku: "",
                priceDisplay: "",
              })
            }
            disabled={saving}
          />
          <PosCreateItemModifiersBlock
            pendingGroupIds={form.pendingModifierGroupIds}
            onOpenPicker={() => setPickModifiersOpen(true)}
            disabled={saving}
          />
        </div>
      </div>

      <PosCameraBarcodeScanDialog
        open={skuScanOpen}
        onOpenChange={setSkuScanOpen}
        onScan={(raw) => {
          const sku = applyScanToSkuField(raw);
          if (!sku) {
            toast({
              title: t(
                POS_CASHIER_I18N.setupSkuScanIgnored,
                "That code is not a product SKU.",
              ),
              variant: "destructive",
            });
            return;
          }
          patch({ catalogSku: sku });
          setSkuScanOpen(false);
          toast({
            title: t(POS_CASHIER_I18N.setupSkuScanned, "SKU filled from scan"),
            description: sku,
          });
        }}
      />

      <PosPickModifierSetsSheet
        open={pickModifiersOpen}
        onOpenChange={setPickModifiersOpen}
        outletId={outletId}
        selectedIds={form.pendingModifierGroupIds}
        onConfirm={(ids) => patch({ pendingModifierGroupIds: ids })}
        onCreateNew={() => setCreateModifierOpen(true)}
      />

      <ModifierGroupFormSheet
        group={null}
        selectedOutletId={outletId || undefined}
        open={createModifierOpen}
        onOpenChange={setCreateModifierOpen}
        chrome="pos"
        onSaved={(groupId) => {
          setForm((prev) => ({
            ...prev,
            pendingModifierGroupIds: prev.pendingModifierGroupIds.includes(groupId)
              ? prev.pendingModifierGroupIds
              : [...prev.pendingModifierGroupIds, groupId],
          }));
        }}
      />
    </div>
  );

  if (isPhone) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-slate-100">
        <PosSafeAreaTopSpacer />
        {shell}
        <PosSafeAreaBottomSpacer className="bg-slate-100" />
      </div>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        className="flex h-[min(94dvh,980px)] w-[min(94vw,900px)] max-h-[min(94dvh,980px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm [&>button]:hidden"
        aria-describedby={undefined}
      >
        {shell}
      </DialogContent>
    </Dialog>
  );
}
