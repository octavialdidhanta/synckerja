import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import {
  BankAccountSettingsPanel,
  BankAccountSettingsSkeleton,
} from "@/8-2-12-bank-account";
import { useOpsBankAccounts } from "@/8-2-12-bank-account/hooks/useOpsBankAccounts";
import { OutletsModuleShell } from "../layout/OutletsModuleShell";
import { SettingsWorkspace } from "../layout/SettingsWorkspace";

export default function BankAccountSettingsPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { isLoading } = useOpsBankAccounts();
  const showContent = useDebouncedReady(!(orgBootstrapPending || isLoading), 200);

  return (
    <OutletsModuleShell
      showContent={showContent}
      overlaySkeleton={<BankAccountSettingsSkeleton />}
    >
      <SettingsWorkspace>
        <BankAccountSettingsPanel />
      </SettingsWorkspace>
    </OutletsModuleShell>
  );
}
