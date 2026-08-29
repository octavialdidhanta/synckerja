import { useCallback, useState } from "react";
import { usePosPinAccessPolicy } from "../hooks/usePosPinAccessPolicy";
import type { PosPinFeatureKey } from "../lib/posPinFeatures";
import { PosAdminPinDialog } from "../components/PosAdminPinDialog";

/**
 * Light gate: if org requires PIN for `feature`, open admin PIN dialog before `action`.
 * Ready for print/discount/refund wiring; no-op when feature not required.
 */
export function usePosPinGate(outletId: string | null) {
  const { requiresPin } = usePosPinAccessPolicy();
  const [pending, setPending] = useState<{
    feature: PosPinFeatureKey;
    action: () => void;
  } | null>(null);

  const runWithPin = useCallback(
    (feature: PosPinFeatureKey, action: () => void) => {
      if (!requiresPin(feature)) {
        action();
        return;
      }
      setPending({ feature, action });
    },
    [requiresPin],
  );

  const dialog = (
    <PosAdminPinDialog
      open={Boolean(pending)}
      outletId={outletId}
      onOpenChange={(open) => {
        if (!open) setPending(null);
      }}
      onAuthorized={() => {
        pending?.action();
        setPending(null);
      }}
    />
  );

  return { runWithPin, pinDialog: dialog, requiresPin };
}
