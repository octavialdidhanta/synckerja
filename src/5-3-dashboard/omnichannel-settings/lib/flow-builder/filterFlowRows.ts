import { isSameDay } from "date-fns";
import type {
  FlowBuilderListingFilters,
  FlowBuilderListingRow,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesUserFilter(
  rowUserId: string | null | undefined,
  filterUserId: string | null,
  rows: FlowBuilderListingRow[],
  pickUser: (row: FlowBuilderListingRow) => FlowBuilderListingRow["createdBy"],
): boolean {
  if (!filterUserId) return true;
  const anyRowHasUser = rows.some((row) => pickUser(row)?.id);
  if (!anyRowHasUser) return true;
  return rowUserId === filterUserId;
}

export function filterFlowRows(
  rows: FlowBuilderListingRow[],
  filters: FlowBuilderListingFilters,
): FlowBuilderListingRow[] {
  const q = normalizeQuery(filters.search);

  return rows.filter((row) => {
    if (q && !normalizeQuery(row.name).includes(q)) return false;

    if (filters.status === "active" && row.status !== "ACTIVE") return false;
    if (filters.status === "draft" && row.status !== "DRAFT") return false;

    if (!matchesUserFilter(row.createdBy?.id, filters.createdById, rows, (r) => r.createdBy)) {
      return false;
    }
    if (!matchesUserFilter(row.lastUpdatedBy?.id, filters.updatedById, rows, (r) => r.lastUpdatedBy)) {
      return false;
    }

    if (filters.lastUpdatedDate) {
      if (!row.lastUpdatedAt) return false;
      if (!isSameDay(new Date(row.lastUpdatedAt), filters.lastUpdatedDate)) return false;
    }

    return true;
  });
}
