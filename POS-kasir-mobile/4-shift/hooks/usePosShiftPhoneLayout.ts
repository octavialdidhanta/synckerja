import { useCallback, useEffect, useState } from "react";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import {
  POS_SHIFT_PHONE_PANE_DEFAULT,
  type PosShiftPhonePane,
} from "../lib/posShiftPhoneLayout";

/**
 * Phone Shift shell: single-pane List|Detail when viewport ≤ 767px.
 */
export function usePosShiftPhoneLayout() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  const [pane, setPaneState] = useState<PosShiftPhonePane>(
    POS_SHIFT_PHONE_PANE_DEFAULT,
  );

  useEffect(() => {
    if (!isPhoneLayout) {
      setPaneState(POS_SHIFT_PHONE_PANE_DEFAULT);
    }
  }, [isPhoneLayout]);

  const setPane = useCallback((next: PosShiftPhonePane) => {
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
