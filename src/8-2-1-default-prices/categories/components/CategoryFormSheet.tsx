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
import { useCatalogProductCategories } from "../hooks/useCatalogProductCategories";
import type { CatalogProductCategory } from "../types";
import { CategoryOutletsSection } from "./CategoryOutletsSection";

export type CategoryFormSheetProps = {
  category: CatalogProductCategory | null;
  selectedOutletId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (category: CatalogProductCategory) => void;
  /** POS library: full page, no black sheet overlay. */
  chrome?: "default" | "pos";
};

export function CategoryFormSheet({
  category,
  selectedOutletId,
  open,
  onOpenChange,
  onCreated,
  chrome = "default",
}: CategoryFormSheetProps) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogProductCategories();
  const [name, setName] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    refreshNativeSafeAreaChromeInsets();
    if (category) {
      setName(category.name);
      setOutletIds([...(category.outlet_ids ?? [])]);
      return;
    }
    setName("");
    setOutletIds(selectedOutletId ? [selectedOutletId] : []);
  }, [open, category, selectedOutletId]);

  const title = category
    ? t("defaultPrices.category.editTitle", "Edit category")
    : t("defaultPrices.category.addTitle", "New category");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: t("defaultPrices.product.categoryNameRequired", "Enter a category name."),
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
      const saved = await save({
        id: category?.id,
        name: trimmed,
        outlet_ids: outletIds,
      });
      toast({ title: t("defaultPrices.category.saved", "Category saved.") });
      if (!category) onCreated?.(saved);
      onOpenChange(false);
    } catch {
      toast({
        title: t("defaultPrices.product.categorySaveFailed", "Could not save category."),
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
          {t("common.save", "Save")}
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
          {t("defaultPrices.category.nameSection", "Category")}
        </p>
        <div className={cn(POS_PANEL.card, "mb-1")}>
          <div className={POS_PANEL.formRow}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("defaultPrices.product.categoryPlaceholder", "e.g. Drinks")}
              className={POS_PANEL.formInput}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
          </div>
        </div>

        <CategoryOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
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
