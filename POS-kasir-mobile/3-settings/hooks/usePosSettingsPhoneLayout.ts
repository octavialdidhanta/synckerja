import { useCallback, useEffect, useState } from "react";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import {
  POS_SETTINGS_PHONE_PANE_DEFAULT,
  type PosSettingsPhonePane,
} from "../lib/posSettingsPhoneLayout";

/**
 * Phone Settings shell: single-pane List|Detail when viewport ≤ 767px.
 */
export function usePosSettingsPhoneLayout() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  const [pane, setPaneState] = useState<PosSettingsPhonePane>(
    POS_SETTINGS_PHONE_PANE_DEFAULT,
  );

  useEffect(() => {
    if (!isPhoneLayout) {
      setPaneState(POS_SETTINGS_PHONE_PANE_DEFAULT);
    }
  }, [isPhoneLayout]);

  const setPane = useCallback((next: PosSettingsPhonePane) => {
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
