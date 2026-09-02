import { useEffect, useMemo, useRef, useState } from "react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PublicOrderItemOptions } from "@/synckerja-order/shared/lib/orderTypes";
import { cartLineToCustomizeSelection } from "../../cart-sheet/lib/cartLineToCustomizeSelection";
import { bumpOptionQty } from "../lib/orderCustomizeOptionQty";
import {
  defaultOrderCustomizeSelection,
  isGroupSelectionValid,
  isOrderCustomizeValid,
  orderCustomizeLineTotal,
  orderCustomizeUnitPrice,
  toggleOrderCustomizeOption,
  type OrderCustomizeSelection,
} from "../lib/orderCustomizeSelection";

export function useOrderItemCustomizeState(
  options: PublicOrderItemOptions | undefined,
  initialLine?: CustomerVisitCartLine | null,
) {
  const [selection, setSelection] = useState<OrderCustomizeSelection>({
    variantId: null,
    selectedByGroup: {},
    qtyByGroup: {},
  });
  const [qty, setQty] = useState(1);
  const [kitchenNote, setKitchenNote] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const editing = Boolean(initialLine?.lineKey);
  const initialKey = initialLine?.lineKey ?? "";
  const hydrateLineRef = useRef(initialLine);
  if (initialLine && hydrateLineRef.current?.lineKey !== initialLine.lineKey) {
    hydrateLineRef.current = initialLine;
  }
  if (!initialKey) hydrateLineRef.current = null;

  useEffect(() => {
    if (!options?.ok) {
      setHydrated(false);
      return;
    }
    const line = hydrateLineRef.current;
    if (line) {
      const hydratedLine = cartLineToCustomizeSelection(options, line);
      setSelection(hydratedLine.selection);
      setQty(Math.max(1, line.quantity));
      setKitchenNote(hydratedLine.kitchenNote);
    } else {
      setSelection(defaultOrderCustomizeSelection(options));
      setQty(1);
      setKitchenNote("");
    }
    setHydrated(true);
  }, [options, initialKey]);

  const valid = useMemo(
    () => (options?.ok ? isOrderCustomizeValid(options, selection) : false),
    [options, selection],
  );

  const unitPrice = useMemo(
    () => (options?.ok ? orderCustomizeUnitPrice(options, selection) : 0),
    [options, selection],
  );

  const lineTotal = useMemo(
    () => (options?.ok ? orderCustomizeLineTotal(options, selection, qty) : 0),
    [options, selection, qty],
  );

  const groupValid = (groupId: string) => {
    const group = options?.modifier_groups.find((g) => g.id === groupId);
    if (!group) return false;
    return isGroupSelectionValid(
      group,
      selection.selectedByGroup[groupId] ?? [],
      selection.qtyByGroup[groupId],
    );
  };

  const setVariantId = (variantId: string) => {
    setSelection((prev) => ({ ...prev, variantId }));
  };

  const toggleOption = (groupId: string, optionId: string, outOfStock: boolean) => {
    const group = options?.modifier_groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelection((prev) => ({
      ...prev,
      selectedByGroup: {
        ...prev.selectedByGroup,
        [groupId]: toggleOrderCustomizeOption(
          group,
          prev.selectedByGroup[groupId] ?? [],
          optionId,
          outOfStock,
        ),
      },
    }));
  };

  const setOptionQty = (groupId: string, optionId: string, delta: number, outOfStock: boolean) => {
    const group = options?.modifier_groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelection((prev) => ({
      ...prev,
      qtyByGroup: {
        ...prev.qtyByGroup,
        [groupId]: bumpOptionQty({
          group,
          qtyByOption: prev.qtyByGroup[groupId],
          optionId,
          delta,
          outOfStock,
        }),
      },
    }));
  };

  const bumpQty = (delta: number) => {
    if (editing) return;
    setQty((n) => Math.max(1, n + delta));
  };

  return {
    selection,
    qty,
    kitchenNote,
    valid,
    unitPrice,
    lineTotal,
    groupValid,
    setVariantId,
    toggleOption,
    setOptionQty,
    setKitchenNote,
    bumpQty,
    editing,
    hydrated,
  };
}
