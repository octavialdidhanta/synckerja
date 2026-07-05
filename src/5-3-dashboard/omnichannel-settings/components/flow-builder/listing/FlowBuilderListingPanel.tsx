import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { FlowBuilderCreateAutomationFlowDialog } from "@/5-3-automation-flow/components/editor/wizard/CreateAutomationFlowDialog";
import { automationFlowEditorPath } from "@/5-3-automation-flow/constants/automationFlowPaths";
import { FlowBuilderActiveFlowsLimit } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderActiveFlowsLimit";
import { FlowBuilderDeleteFlowsDialog } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderDeleteFlowsDialog";
import { FlowBuilderListingToolbar } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderListingToolbar";
import {
  FlowBuilderListingPagination,
  FlowBuilderListingTable,
} from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderListingTable";
import { FLOW_BUILDER_LISTING_PAGE_SIZE } from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderFilters";
import { filterFlowRows } from "@/5-3-dashboard/omnichannel-settings/lib/flow-builder/filterFlowRows";
import {
  automationFlowListingQueryKey,
  useAutomationFlowListing,
  useDeleteAutomationFlows,
} from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useAutomationFlowListing";
import type {
  FlowBuilderListingFilters,
  FlowBuilderListingRow,
  FlowBuilderUserOption,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

const DEFAULT_FILTERS: FlowBuilderListingFilters = {
  search: "",
  status: "all",
  createdById: null,
  updatedById: null,
  lastUpdatedDate: null,
};

function mapStaffToUserOptions(
  staffRows: ReturnType<typeof useOrganizationOmnichannelStaff>["data"],
): FlowBuilderUserOption[] {
  return (staffRows ?? [])
    .map((row) => {
      const employee = row.employees;
      if (!employee?.id) return null;
      return {
        id: employee.id,
        fullName: employee.full_name?.trim() || employee.email?.trim() || "—",
        email: employee.email?.trim() || "",
      };
    })
    .filter((row): row is FlowBuilderUserOption => row != null);
}

export function FlowBuilderListingPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { data: staffRows = [] } = useOrganizationOmnichannelStaff();
  const { data: flows = [], isPending, isError, error } = useAutomationFlowListing();
  const deleteFlows = useDeleteAutomationFlows();

  const [filters, setFilters] = useState<FlowBuilderListingFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const userOptions = useMemo(() => mapStaffToUserOptions(staffRows), [staffRows]);

  const rowsWithOrg = flows;

  const filteredRows = useMemo(
    () => filterFlowRows(rowsWithOrg, filters),
    [rowsWithOrg, filters],
  );

  const activeCount = useMemo(
    () => rowsWithOrg.filter((row) => row.status === "ACTIVE").length,
    [rowsWithOrg],
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / FLOW_BUILDER_LISTING_PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), pageCount));
  }, [pageCount]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * FLOW_BUILDER_LISTING_PAGE_SIZE;
    return filteredRows.slice(start, start + FLOW_BUILDER_LISTING_PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(filteredRows.map((row) => row.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredRows]);

  const updateFilters = (patch: Partial<FlowBuilderListingFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(paginatedRows.map((row) => row.id)));
  };

  const handleViewFlowLog = (_row: FlowBuilderListingRow) => {
    toast.message(t("omnichannel.settings.flowBuilder.listing.flowLogComingSoon"));
  };

  const handleFlowCreated = () => {
    if (organizationId) {
      void queryClient.invalidateQueries({ queryKey: automationFlowListingQueryKey(organizationId) });
    }
    toast.success(t("omnichannel.settings.flowBuilder.listing.createSuccess"));
  };

  const handleConfirmDelete = async () => {
    const flowIds = [...selectedIds];
    if (flowIds.length === 0) return;

    try {
      await deleteFlows.mutateAsync(flowIds);
      setSelectedIds(new Set());
      setDeleteOpen(false);
      toast.success(t("omnichannel.settings.flowBuilder.listing.deleteSuccess", { count: flowIds.length }));
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : t("omnichannel.settings.flowBuilder.listing.deleteFailed"),
      );
    }
  };

  const selectedCount = selectedIds.size;

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error instanceof Error ? error.message : t("omnichannel.settings.flowBuilder.listing.loadFailed")}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <FlowBuilderListingToolbar
          filters={filters}
          users={userOptions}
          onSearchChange={(search) => updateFilters({ search })}
          onStatusChange={(status) => updateFilters({ status })}
          onCreatedByChange={(createdById) => updateFilters({ createdById })}
          onUpdatedByChange={(updatedById) => updateFilters({ updatedById })}
          onLastUpdatedDateChange={(lastUpdatedDate) => updateFilters({ lastUpdatedDate })}
          onResetFilters={resetFilters}
          onCreateClick={() => setCreateOpen(true)}
          selectedCount={selectedCount}
          onDeleteClick={() => setDeleteOpen(true)}
          limitBar={<FlowBuilderActiveFlowsLimit activeCount={activeCount} />}
        />

        <FlowBuilderListingTable
          rows={paginatedRows}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onViewFlowLog={handleViewFlowLog}
          onOpenFlow={(row) => navigate(automationFlowEditorPath(row.id))}
        />

        {filteredRows.length > FLOW_BUILDER_LISTING_PAGE_SIZE ? (
          <FlowBuilderListingPagination page={page} pageCount={pageCount} onPageChange={setPage} />
        ) : null}
      </div>

      <FlowBuilderCreateAutomationFlowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleFlowCreated}
      />

      <FlowBuilderDeleteFlowsDialog
        open={deleteOpen}
        count={selectedCount}
        loading={deleteFlows.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}
