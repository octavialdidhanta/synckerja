import { useCallback, useEffect, useState } from "react";
import {
  POS_CASHIER_PHONE_PANE_DEFAULT,
  type PosCashierPhonePane,
} from "../lib/posCashierPhoneLayout";
import { usePosCashierIsPhoneLayout } from "./usePosCashierIsPhoneLayout";

/**
 * Phone cashier shell: single-pane Menu|Bill when viewport ≤ 767px.
 * Does not use `useIsMobile` (that forces Capacitor tablets into “mobile”).
 */
export function usePosCashierPhoneLayout() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  const [pane, setPaneState] = useState<PosCashierPhonePane>(POS_CASHIER_PHONE_PANE_DEFAULT);

  useEffect(() => {
    if (!isPhoneLayout) {
      setPaneState(POS_CASHIER_PHONE_PANE_DEFAULT);
    }
  }, [isPhoneLayout]);

  const setPane = useCallback((next: PosCashierPhonePane) => {
    setPaneState(next);
  }, []);

  const showMenu = useCallback(() => setPaneState("menu"), []);
  const showBill = useCallback(() => setPaneState("bill"), []);

  return {
    isPhoneLayout,
    pane,
    setPane,
    showMenu,
    showBill,
  };
}
