import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { ReceiptSettings, ReceiptSettingsPageSkeleton, useOutletReceiptSettings } from "@/8-2-6-receipt";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout";
import { usePosOutlets } from "../hooks/usePosOutlets";
import { useSelectedPosOutlet } from "../hooks/useSelectedPosOutlet";
import { OutletsModuleShell } from "../layout/OutletsModuleShell";
import { SettingsWorkspace } from "../layout/SettingsWorkspace";

export default function ReceiptSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const outlets = usePosOutlets();
  const { selectedOutletId, isLoading: outletSelectionLoading } = useSelectedPosOutlet();
  const checkout = useCatalogCheckoutSettings();
  const receipt = useOutletReceiptSettings(selectedOutletId || null);

  const hasPendingLoad =
    orgBootstrapPending ||
    outlets.isLoading ||
    outletSelectionLoading ||
    checkout.isLoading ||
    (Boolean(selectedOutletId) && receipt.isLoading);

  const showContent = useDebouncedReady(!hasPendingLoad, 200);

  return (
    <OutletsModuleShell showContent={showContent} overlaySkeleton={<ReceiptSettingsPageSkeleton />}>
      <SettingsWorkspace>
        <ReceiptSettings />
      </SettingsWorkspace>
    </OutletsModuleShell>
  );
}
