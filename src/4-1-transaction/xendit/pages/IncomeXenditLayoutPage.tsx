import { Outlet, useLocation } from "react-router-dom";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { IncomeXenditModuleShell } from "@/4-1-transaction/xendit/layout/IncomeXenditModuleShell";
import { IncomeXenditPageSkeleton } from "@/4-1-transaction/xendit/skeletons/IncomeXenditPageSkeleton";
import { XENDIT_BALANCE_PATH, XENDIT_HISTORY_PATH } from "@/xendit/lib/xenditPaths";

function resolveXenditSkeletonVariant(pathname: string): "connect" | "balance" | "history" {
  if (pathname.startsWith(XENDIT_HISTORY_PATH)) return "history";
  if (pathname.startsWith(XENDIT_BALANCE_PATH)) return "balance";
  return "connect";
}

export default function IncomeXenditLayoutPage() {
  const { pathname } = useLocation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { loading: orgLoading } = useCurrentOrg();
  const showContent = useDebouncedReady(!orgBootstrapPending && !orgLoading, 200);

  if (orgBootstrapPending) {
    return <IncomeXenditPageSkeleton variant={resolveXenditSkeletonVariant(pathname)} />;
  }

  return (
    <IncomeXenditModuleShell showContent={showContent}>
      <Outlet />
    </IncomeXenditModuleShell>
  );
}
