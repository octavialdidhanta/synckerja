import { useEffect, useState } from "react";
import { POS_CASHIER_PHONE_MAX_WIDTH } from "../lib/posCashierPhoneLayout";

/** True when viewport ≤ 767px (phone cashier shell). */
export function usePosCashierIsPhoneLayout(): boolean {
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= POS_CASHIER_PHONE_MAX_WIDTH;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${POS_CASHIER_PHONE_MAX_WIDTH}px)`);
    const sync = () => setIsPhone(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isPhone;
}
