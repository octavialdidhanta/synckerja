import { useEffect } from "react";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { posAuthFlickerLog } from "../lib/posAuthFlickerLog";
import { usePosAuthFunnelChrome } from "./PosAuthFunnelChrome";

/**
 * Top-level Suspense fallback for POS auth.
 * When chrome owns the brand, keep that logo — only reserve empty step area.
 */
export function PosAuthFunnelSuspenseFallback() {
  const chromeOwnsBrand = usePosAuthFunnelChrome();

  useEffect(() => {
    posAuthFlickerLog("suspense_fallback_mount", { chromeOwnsBrand });
    return () => posAuthFlickerLog("suspense_fallback_unmount", { chromeOwnsBrand });
  }, [chromeOwnsBrand]);

  if (chromeOwnsBrand) {
    return <span className="sr-only">Loading</span>;
  }

  return (
    <PosAuthViewport>
      <div className="flex w-full shrink-0 justify-center">
        <PosBrandMark />
      </div>
      <span className="sr-only">Loading</span>
    </PosAuthViewport>
  );
}
