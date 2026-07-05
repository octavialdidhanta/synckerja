export type AutomationFlowNodeType =
  | "start"
  | "condition"
  | "action_send_message"
  | "action_wait_reply"
  | "action_update_contact"
  | "action_assign_to"
  | "action_http_request"
  | "time_delay"
  | "end";

export type AutomationFlowReEnrollmentRule = "not_in_flow" | "never" | "always";

export type AutomationFlowTriggerType = "incoming_message_received";

export type AutomationFlowConditionOperator =
  | "contains"
  | "equals"
  | "not_equals"
  | "is_empty"
  | "is_not_empty";

export type AutomationFlowConditionField =
  | "label"
  | "keyword"
  | "conversation_status";

export type AutomationFlowConditionRule = {
  id: string;
  field: AutomationFlowConditionField;
  operator: AutomationFlowConditionOperator;
  value: string;
};

export type AutomationFlowStartData = {
  triggerType: AutomationFlowTriggerType;
  phoneNumberIds: string[];
  enrollmentFilters: AutomationFlowConditionRule[];
};

export type AutomationFlowConditionData = {
  matchMode: "all" | "any";
  rules: AutomationFlowConditionRule[];
};

export type SendMessageButtonType = "none" | "quick_reply" | "list_message";

export type ListMessageOption = {
  id: string;
  title: string;
  description?: string;
};

export type AutomationFlowSendMessageData = {
  body: string;
  buttonType: SendMessageButtonType;
  listButtonText?: string;
  listSectionTitle?: string;
  listOptions?: ListMessageOption[];
  buttonAsBranch?: boolean;
};

export type AutomationFlowTimeDelayData = {
  duration: number;
  unit: "minutes" | "hours" | "days";
};

export type AutomationFlowWaitReplyData = {
  saveAsVariable: string;
  timeoutMinutes?: number;
};

export type AutomationFlowUpdateContactData = {
  leadStatusId?: string | null;
  category?: string | null;
  services?: string | null;
};

export type AutomationFlowHttpRequestData = {
  url: string;
  method: "POST" | "GET";
  bodyTemplate: string;
};

export type AssignToMode = "unassigned" | "specific_user" | "specific_team";

export type AutomationFlowAssignToData = {
  assignMode: AssignToMode;
  employeeId?: string | null;
  departmentId?: string | null;
};

export type AutomationFlowEndMode = "flow_end" | "jump_to";

export type AutomationFlowEndData = {
  mode?: AutomationFlowEndMode;
  jumpToNodeId?: string | null;
  isBranchTerminal?: boolean;
  branchParentSendId?: string;
  branchHandle?: string;
};

export type AutomationFlowNodeData =
  | AutomationFlowStartData
  | AutomationFlowConditionData
  | AutomationFlowSendMessageData
  | AutomationFlowTimeDelayData
  | AutomationFlowWaitReplyData
  | AutomationFlowUpdateContactData
  | AutomationFlowAssignToData
  | AutomationFlowHttpRequestData
  | AutomationFlowEndData
  | Record<string, never>;

export type AutomationFlowGraphNode = {
  id: string;
  type: AutomationFlowNodeType;
  position: { x: number; y: number };
  data: AutomationFlowNodeData;
};

export type AutomationFlowGraphEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type AutomationFlowGraph = {
  nodes: AutomationFlowGraphNode[];
  edges: AutomationFlowGraphEdge[];
  viewport: { x: number; y: number; zoom: number };
};

export type AutomationFlowTriggerConfig = {
  triggerType: AutomationFlowTriggerType;
  phoneNumberIds: string[];
  enrollmentFilters: AutomationFlowConditionRule[];
};
