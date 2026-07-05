import type { AutomationFlowNodeType } from "@/5-3-automation-flow/types/automationFlowGraph.types";

export const AUTOMATION_FLOW_NODE_TYPES: AutomationFlowNodeType[] = [
  "start",
  "condition",
  "action_send_message",
  "action_wait_reply",
  "action_update_contact",
  "action_assign_to",
  "action_http_request",
  "time_delay",
  "end",
];

export const AUTOMATION_FLOW_MVP_RUNTIME_NODES: AutomationFlowNodeType[] = [
  "start",
  "condition",
  "action_send_message",
  "action_assign_to",
  "time_delay",
  "end",
];
