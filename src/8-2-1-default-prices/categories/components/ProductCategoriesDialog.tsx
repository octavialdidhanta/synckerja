import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CatalogProductCategory } from "../types";
import { ProductCategoriesManager } from "./ProductCategoriesManager";

export type ProductCategoriesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (category: CatalogProductCategory) => void;
};

export function ProductCategoriesDialog({ open, onOpenChange, onSelect }: ProductCategoriesDialogProps) {
  const { t } = useAppTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("defaultPrices.product.manageCategories", "Manage categories")}</DialogTitle>
        </DialogHeader>
        {open ? <ProductCategoriesManager onSelect={onSelect} enableAssignToItem={false} /> : null}
      </DialogContent>
    </Dialog>
  );
}
