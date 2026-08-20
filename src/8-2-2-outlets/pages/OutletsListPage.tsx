import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useOutletQuota } from "../hooks/useOutletQuota";
import { OutletsListManager } from "../components/OutletsListManager";
import { OutletsModuleShell } from "../layout/OutletsModuleShell";
import { SettingsWorkspace } from "../layout/SettingsWorkspace";

export default function OutletsListPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const quota = useOutletQuota();
  const showContent = useDebouncedReady(!(orgBootstrapPending || quota.isLoading), 200);

  return (
    <OutletsModuleShell showContent={showContent}>
      <SettingsWorkspace>
        <OutletsListManager />
      </SettingsWorkspace>
    </OutletsModuleShell>
  );
}
