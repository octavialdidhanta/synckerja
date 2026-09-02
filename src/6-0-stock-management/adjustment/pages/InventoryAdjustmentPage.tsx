import { useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { InventoryWorkspace } from "@/6-0-stock-management/layout/InventoryWorkspace";
import { InventoryAdjustmentSkeleton } from "../skeletons/InventoryAdjustmentSkeleton";
import { InventoryAdjustmentToolbar } from "../components/InventoryAdjustmentToolbar";
import { InventoryAdjustmentStats } from "../components/InventoryAdjustmentStats";
import { InventoryAdjustmentTable } from "../components/InventoryAdjustmentTable";
import { CreateInventoryAdjustmentDialog } from "../components/CreateInventoryAdjustmentDialog";
import { useInventoryAdjustmentsQuery } from "../hooks/useInventoryAdjustmentsQuery";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { InventoryAdjustmentKindFilter } from "../types";

export function InventoryAdjustmentPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending, organizationId: orgId } = useOrgBootstrapPending();
  const { canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { selectedOutletId, setSelectedOutletId, isLoading: outletLoading } = useSelectedPosOutlet(true, { allowAll: false });

  const [kind, setKind] = useState<InventoryAdjustmentKindFilter>("item_library");
  const [from, setFrom] = useState(() => startOfDay(new Date()));
  const [to, setTo] = useState(() => endOfDay(new Date()));
  const [createOpen, setCreateOpen] = useState(false);

  const query = useInventoryAdjustmentsQuery({
    organizationId: orgId,
    outletId: selectedOutletId,
    kind,
    periodStart: from,
    periodEnd: to,
  });

  const dataPending = orgBootstrapPending || gatePending || outletLoading || query.isLoading;
  const showContent = useDebouncedReady(!dataPending, 180);

  const stats = query.data?.stats ?? {
    adjustmentsCount: 0,
    itemsAdjusted: 0,
    totalAdjustmentExpense: 0,
    totalAdjustmentIncome: 0,
  };
  const batches = query.data?.batches ?? [];

  if (!showContent) return <InventoryAdjustmentSkeleton />;

  return (
    <>
      <StockManagementModuleShell>
        <InventoryWorkspace count={batches.length}>
            <div className="border-b px-4 py-3">
              <InventoryAdjustmentToolbar
                outletId={selectedOutletId}
                onOutletChange={setSelectedOutletId}
                kind={kind}
                onKindChange={(nextKind) => {
                  setKind(nextKind);
                  setCreateOpen(false);
                }}
                from={from}
                to={to}
                onRangeChange={(nextFrom, nextTo) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
                canManage={canManage}
                creating={query.isLoading}
                onCreateClick={() => setCreateOpen(true)}
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <InventoryAdjustmentStats stats={stats} />
              <InventoryAdjustmentTable batches={batches} kind={kind} />
              {query.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {query.error instanceof Error ? query.error.message : t("common.error", "Something went wrong.")}
                </div>
              ) : null}
            </div>
        </InventoryWorkspace>
      </StockManagementModuleShell>

      {canManage ? (
        <CreateInventoryAdjustmentDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={orgId ?? ""}
          outletId={selectedOutletId}
          kind={kind}
        />
      ) : null}
    </>
  );
}

