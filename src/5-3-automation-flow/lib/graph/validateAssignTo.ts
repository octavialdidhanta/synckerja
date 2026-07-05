import type { GraphValidationIssue } from "@/5-3-automation-flow/lib/graph/validateGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

type GraphNode = { id: string; type: string; data?: Record<string, unknown> };

export function validateAssignToRules(node: GraphNode): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  if (node.type !== "action_assign_to") return issues;

  const mode = String(node.data?.assignMode ?? "specific_user");
  if (mode === "specific_user") {
    const employeeId = String(node.data?.employeeId ?? "").trim();
    if (!employeeId) {
      issues.push({
        code: "ASSIGN_USER_REQUIRED",
        message: "Assign to Specific user requires selecting an agent.",
        nodeId: node.id,
      });
    }
  }
  if (mode === "specific_team") {
    const departmentId = String(node.data?.departmentId ?? "").trim();
    if (!departmentId) {
      issues.push({
        code: "ASSIGN_TEAM_REQUIRED",
        message: "Assign to Specific team requires selecting a department.",
        nodeId: node.id,
      });
    }
  }
  return issues;
}

export function validateAssignToRulesForGraph(graph: AutomationFlowGraph): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  for (const node of graph.nodes ?? []) {
    if (node.type === "action_assign_to") {
      issues.push(...validateAssignToRules(node));
    }
  }
  return issues;
}
