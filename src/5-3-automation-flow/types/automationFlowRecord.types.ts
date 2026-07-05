import type {
  AutomationFlowGraph,
  AutomationFlowReEnrollmentRule,
  AutomationFlowTriggerConfig,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";

export type AutomationFlowStatus = "draft" | "active" | "archived";

export type AutomationFlowRecord = {
  id: string;
  organization_id: string;
  name: string;
  status: AutomationFlowStatus;
  graph_json: AutomationFlowGraph;
  published_graph_json: AutomationFlowGraph | null;
  trigger_config: AutomationFlowTriggerConfig;
  re_enrollment_rule: AutomationFlowReEnrollmentRule;
  version: number;
  published_at: string | null;
  published_by_employee_id: string | null;
  created_by_employee_id: string | null;
  updated_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationFlowEnrollmentStatus =
  | "active"
  | "paused"
  | "waiting_for_reply"
  | "completed"
  | "failed";

export type AutomationFlowEnrollment = {
  id: string;
  organization_id: string;
  flow_id: string;
  conversation_id: string;
  channel: "whatsapp";
  status: AutomationFlowEnrollmentStatus;
  current_node_id: string | null;
  context_json: Record<string, unknown>;
  paused_reason: "assignee_taken_over" | "manual" | null;
  created_at: string;
  updated_at: string;
};

export type AutomationFlowRunEvent = {
  id: string;
  organization_id: string;
  flow_id: string;
  enrollment_id: string | null;
  event_type: string;
  node_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};
