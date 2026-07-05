export type FlowRuntimeInboundPayload = {
  organizationId: string;
  conversationId: string;
  channel: "whatsapp";
  messageId: string;
  messageBody: string;
  phoneNumberId: string | null;
  customerWaId: string;
  isResumeFromWait?: boolean;
};

export type FlowRuntimeDelayPayload = {
  enrollmentId: string;
  targetNodeId: string;
};

export type FlowRuntimeSendPayload = {
  organizationId: string;
  conversationId: string;
  enrollmentId: string;
  flowId: string;
  nodeId: string;
  text: string;
};
