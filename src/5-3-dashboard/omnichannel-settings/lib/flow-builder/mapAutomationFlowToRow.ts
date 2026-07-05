import type { AutomationFlowRecord } from "@/5-3-automation-flow/types/automationFlowRecord.types";
import type {
  FlowBuilderListingRow,
  FlowBuilderUserRef,
} from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

function normalizeRowStatus(raw: string | undefined): FlowBuilderListingRow["status"] {
  const status = String(raw ?? "").trim().toLowerCase();
  if (status === "active") return "ACTIVE";
  if (status === "draft") return "DRAFT";
  return "OTHER";
}

type EmployeeLookup = Map<string, FlowBuilderUserRef>;

export function buildEmployeeLookup(
  staffRows: Array<{
    employees?: { id?: string; full_name?: string | null; email?: string | null } | null;
  }>,
): EmployeeLookup {
  const map = new Map<string, FlowBuilderUserRef>();
  for (const row of staffRows) {
    const emp = row.employees;
    if (!emp?.id) continue;
    map.set(emp.id, {
      id: emp.id,
      fullName: emp.full_name?.trim() || emp.email?.trim() || "—",
      email: emp.email?.trim() || "",
    });
  }
  return map;
}

export function mapAutomationFlowToRow(
  flow: AutomationFlowRecord,
  employeeLookup: EmployeeLookup,
): FlowBuilderListingRow {
  const createdBy = flow.created_by_employee_id
    ? employeeLookup.get(flow.created_by_employee_id) ?? null
    : null;
  const lastUpdatedBy = flow.updated_by_employee_id
    ? employeeLookup.get(flow.updated_by_employee_id) ?? null
    : null;

  return {
    id: flow.id,
    name: flow.name,
    status: normalizeRowStatus(flow.status),
    createdBy,
    lastUpdatedBy,
    lastUpdatedAt: flow.updated_at ?? null,
    kind: "automation",
  };
}
