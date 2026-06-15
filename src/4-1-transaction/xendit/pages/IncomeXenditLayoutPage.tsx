import { Outlet } from "react-router-dom";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { IncomeXenditModuleShell } from "@/4-1-transaction/xendit/layout/IncomeXenditModuleShell";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";

export default function IncomeXenditLayoutPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { loading: orgLoading } = useCurrentOrg();
  const showContent = useDebouncedReady(!orgBootstrapPending && !orgLoading, 200);

  if (orgBootstrapPending) {
    return <IncomeXenditPageSkeleton />;
  }

  return (
    <IncomeXenditModuleShell showContent={showContent}>
      <Outlet />
    </IncomeXenditModuleShell>
  );
}
