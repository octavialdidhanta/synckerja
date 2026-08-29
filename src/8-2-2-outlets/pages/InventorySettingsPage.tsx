import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { InventorySettingsPageContent, useCatalogInventorySettings } from "@/8-2-5-inventory-settings";
import { OutletsModuleShell } from "../layout/OutletsModuleShell";
import { SettingsWorkspace } from "../layout/SettingsWorkspace";

export default function InventorySettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const settings = useCatalogInventorySettings();
  const showContent = useDebouncedReady(!(orgBootstrapPending || settings.isLoading), 200);

  return (
    <OutletsModuleShell showContent={showContent}>
      <SettingsWorkspace>
        <InventorySettingsPageContent />
      </SettingsWorkspace>
    </OutletsModuleShell>
  );
}
