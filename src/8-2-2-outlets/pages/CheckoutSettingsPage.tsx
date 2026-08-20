import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { LibraryCheckoutSettings, useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout";
import { OutletsModuleShell } from "../layout/OutletsModuleShell";
import { SettingsWorkspace } from "../layout/SettingsWorkspace";

export default function CheckoutSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const checkout = useCatalogCheckoutSettings();
  const showContent = useDebouncedReady(!(orgBootstrapPending || checkout.isLoading), 200);

  return (
    <OutletsModuleShell showContent={showContent}>
      <SettingsWorkspace>
        <LibraryCheckoutSettings />
      </SettingsWorkspace>
    </OutletsModuleShell>
  );
}
