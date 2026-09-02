import type { ReactNode } from "react";
import { useLeadMagnetEntitlement } from "../hooks/useLeadMagnetEntitlement";
import { LeadMagnetAddonUpsellPanel } from "./LeadMagnetAddonUpsellPanel";
import { LeadMagnetListPageSkeleton } from "../skeletons/LeadMagnetPageSkeletons";
import { cn } from "@/shared/lib/utils";

type LeadMagnetContentGateProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Second-layer gate after {@link ModuleShellContentGate} (Digital Marketing module).
 * Blocks when Lead Magnet add-on is not entitled; shows grace banner during trial period.
 */
export function LeadMagnetContentGate({ children, className }: LeadMagnetContentGateProps) {
  const {
    hasEntitlement,
    isPending,
    upsellKind,
    graceUntil,
    graceDaysRemaining,
    isSalesTenant,
    billingCycle,
  } = useLeadMagnetEntitlement();

  if (isPending) {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} aria-busy aria-label="Loading">
        <LeadMagnetListPageSkeleton includeHeader={false} />
      </div>
    );
  }

  if (!hasEntitlement && upsellKind) {
    return (
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-4 py-8", className)}>
        <LeadMagnetAddonUpsellPanel
          upsellKind={upsellKind}
          graceUntil={graceUntil}
          graceDaysRemaining={graceDaysRemaining}
          isSalesTenant={isSalesTenant}
          billingCycle={billingCycle}
        />
      </div>
    );
  }

  return <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>{children}</div>;
}
