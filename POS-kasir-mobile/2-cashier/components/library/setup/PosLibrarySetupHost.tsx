import { useEffect, useState } from "react";
import { DiscountFormSheet } from "@/8-2-1-default-prices/discounts";
import { CategoryFormSheet } from "@/8-2-1-default-prices/categories";
import { PosCreateItemScreen } from "./PosCreateItemScreen";
import type { PosLibrarySetupAction } from "./PosLibrarySetupMenu";

type Props = {
  outletId: string;
  canSetup: boolean;
  /** Set by Library home when user picks a setup row; cleared via onActionHandled. */
  action: PosLibrarySetupAction | null;
  onActionHandled: () => void;
  onCatalogChanged?: () => void;
};

/**
 * Hosts Create Item / Discount / Category sheets opened from Library setup section.
 * Persistence uses back-office hooks only (single source of truth).
 */
export function PosLibrarySetupHost({
  outletId,
  canSetup,
  action,
  onActionHandled,
  onCatalogChanged,
}: Props) {
  const [createItemOpen, setCreateItemOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useEffect(() => {
    if (!action || !canSetup) return;
    if (action === "create_item") setCreateItemOpen(true);
    else if (action === "create_discount") setDiscountOpen(true);
    else setCategoryOpen(true);
    onActionHandled();
    // Only react when a new action is requested from Library home.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onActionHandled is a stable setState wrapper from page
  }, [action, canSetup]);

  return (
    <>
      <PosCreateItemScreen
        open={createItemOpen}
        outletId={outletId}
        onClose={() => setCreateItemOpen(false)}
        onSaved={onCatalogChanged}
      />

      <DiscountFormSheet
        discount={null}
        selectedOutletId={outletId}
        chrome="pos"
        open={discountOpen}
        onOpenChange={(open) => {
          setDiscountOpen(open);
          if (!open) onCatalogChanged?.();
        }}
      />

      <CategoryFormSheet
        category={null}
        selectedOutletId={outletId}
        chrome="pos"
        open={categoryOpen}
        onOpenChange={(open) => {
          setCategoryOpen(open);
          if (!open) onCatalogChanged?.();
        }}
        onCreated={() => onCatalogChanged?.()}
      />
    </>
  );
}
