import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { FlowBuilderCreateFlowDialog } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderCreateFlowDialog";
import { FlowBuilderListingToolbar } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderListingToolbar";
import {
  FlowBuilderListingPagination,
  FlowBuilderListingTable,
} from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/FlowBuilderListingTable";
import { FLOW_BUILDER_LISTING_PAGE_SIZE } from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderFilters";
import { filterFlowRows } from "@/5-3-dashboard/omnichannel-settings/lib/flow-builder/filterFlowRows";
import { useWhatsAppFlows } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlows";
import { usePublishWhatsAppFlow } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/usePublishWhatsAppFlow";
import type {
  FlowBuilderListingFilters,
  FlowBuilderListingRow,
  FlowBuilderUserOption,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";
import { useOrganizationOmnichannelStaff } from "@/shared/hooks/useOrganizationOmnichannelStaff";

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

/** Meta WhatsApp Form Flows (Graph API) — separate from Automation Flow. */
export function MetaWhatsAppFormFlowsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: staffRows = [] } = useOrganizationOmnichannelStaff();
  const { data: flows = [], isPending, isError, error } = useWhatsAppFlows();
  const publishMutation = usePublishWhatsAppFlow();
  const [filters, setFilters] = useState<FlowBuilderListingFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);

  const userOptions = useMemo(() => mapStaffToUserOptions(staffRows), [staffRows]);
  const filteredRows = useMemo(() => filterFlowRows(flows, filters), [flows, filters]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / FLOW_BUILDER_LISTING_PAGE_SIZE));

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedIds.has(row.id)),
    [filteredRows, selectedIds],
  );
  const singleSelected = selectedRows.length === 1 ? selectedRows[0] : null;
  const canPublishSingleDraft = singleSelected?.status === "DRAFT";

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), pageCount));
  }, [pageCount]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * FLOW_BUILDER_LISTING_PAGE_SIZE;
    return filteredRows.slice(start, start + FLOW_BUILDER_LISTING_PAGE_SIZE);
  }, [filteredRows, page]);

  const handleViewFlowLog = (row: FlowBuilderListingRow) => {
    navigate(
      `/omnichannel/campaign/templates?catalog=form_flows&flowId=${encodeURIComponent(row.id)}`,
    );
  };

  const handleCreateTemplate = (flowId: string) => {
    navigate(
      `/omnichannel/campaign/templates?catalog=form_flows&flowId=${encodeURIComponent(flowId)}&create=1`,
    );
  };

  const handlePublishSelected = async () => {
    if (!singleSelected || singleSelected.status !== "DRAFT") return;
    try {
      await publishMutation.mutateAsync(singleSelected.id);
      toast.success(t("omnichannel.settings.flowBuilder.formFlows.publishSuccess", "Flow published"));
      setSelectedIds(new Set());
    } catch (publishError) {
      toast.error(
        publishError instanceof Error
          ? publishError.message
          : t("omnichannel.settings.flowBuilder.formFlows.publishFailed", "Failed to publish flow"),
      );
    }
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
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
      <p className="mb-4 text-sm text-muted-foreground">
        {t("omnichannel.settings.flowBuilder.tab.form-flows")} — Meta interactive form flows (not Automation Flow).
      </p>
      <div className="space-y-4">
        <FlowBuilderListingToolbar
          filters={filters}
          users={userOptions}
          onSearchChange={(search) => setFilters((p) => ({ ...p, search }))}
          onStatusChange={(status) => setFilters((p) => ({ ...p, status }))}
          onCreatedByChange={(createdById) => setFilters((p) => ({ ...p, createdById }))}
          onUpdatedByChange={(updatedById) => setFilters((p) => ({ ...p, updatedById }))}
          onLastUpdatedDateChange={(lastUpdatedDate) => setFilters((p) => ({ ...p, lastUpdatedDate }))}
          onResetFilters={() => setFilters(DEFAULT_FILTERS)}
          onCreateClick={() => setCreateOpen(true)}
        />
        {selectedRows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {selectedRows.length} selected
            </span>
            {singleSelected ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => handleCreateTemplate(singleSelected.id)}
                >
                  {t("omnichannel.settings.flowBuilder.formFlows.createTemplate", "Buat template")}
                </Button>
                {canPublishSingleDraft ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={publishMutation.isPending}
                    onClick={() => void handlePublishSelected()}
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {t("omnichannel.settings.flowBuilder.formFlows.publish", "Publish")}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
        <FlowBuilderListingTable
          rows={paginatedRows}
          selectedIds={selectedIds}
          onToggleRow={(id, checked) =>
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (checked) next.add(id);
              else next.delete(id);
              return next;
            })
          }
          onToggleAll={(checked) =>
            setSelectedIds(checked ? new Set(paginatedRows.map((r) => r.id)) : new Set())
          }
          onViewFlowLog={handleViewFlowLog}
        />
        {filteredRows.length > FLOW_BUILDER_LISTING_PAGE_SIZE ? (
          <FlowBuilderListingPagination page={page} pageCount={pageCount} onPageChange={setPage} />
        ) : null}
      </div>
      <FlowBuilderCreateFlowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => toast.success(t("omnichannel.settings.flowBuilder.listing.createSuccess"))}
      />
    </>
  );
}
