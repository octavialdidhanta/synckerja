import { useCallback, useEffect, useState } from "react";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import {
  POS_ACTIVITY_PHONE_PANE_DEFAULT,
  type PosActivityPhonePane,
} from "../lib/posActivityPhoneLayout";

/**
 * Phone Activity shell: single-pane List|Detail when viewport ≤ 767px.
 * Reuses cashier phone breakpoint (not Capacitor `useIsMobile`).
 */
export function usePosActivityPhoneLayout() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  const [pane, setPaneState] = useState<PosActivityPhonePane>(
    POS_ACTIVITY_PHONE_PANE_DEFAULT,
  );

  useEffect(() => {
    if (!isPhoneLayout) {
      setPaneState(POS_ACTIVITY_PHONE_PANE_DEFAULT);
    }
  }, [isPhoneLayout]);

  const setPane = useCallback((next: PosActivityPhonePane) => {
    setPaneState(next);
  }, []);

  const showList = useCallback(() => setPaneState("list"), []);
  const showDetail = useCallback(() => setPaneState("detail"), []);

  return {
    isPhoneLayout,
    pane,
    setPane,
    showList,
    showDetail,
  };
}
