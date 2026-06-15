import { XenditSettingsPanel } from "@/4-0-xendit-settings/components/XenditSettingsPanel";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export default function XenditConnectPage() {
  const { organizationId } = useCurrentOrg();
  const { isLoading, data } = useXenditOrgSettings(organizationId);

  if (isLoading && !data) {
    return <IncomeXenditPageSkeleton variant="connect" />;
  }

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <XenditSettingsPanel layout="standalone" />
      </div>
    </div>
  );
}
