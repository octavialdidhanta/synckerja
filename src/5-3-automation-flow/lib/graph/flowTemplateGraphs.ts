import { createDefaultAutomationFlowGraph } from "@/5-3-automation-flow/lib/graph/defaultGraph";
import { layoutAutomationFlowGraphVertically } from "@/5-3-automation-flow/lib/graph/layoutGraph";
import type { AutomationFlowGraph } from "@/5-3-automation-flow/types/automationFlowGraph.types";

export type FlowTemplateId =
  | "scratch"
  | "welcome_message"
  | "out_of_business_hour"
  | "keyword"
  | "chatbot"
  | "idle_customer"
  | "invalid_reply";

const WELCOME_MESSAGE_BODY = `Hello {{contact.first_name}}!
Selamat datang pada layanan kami.
Kami siap membantu kebutuhan Anda.

Silakan balas pesan ini jika ada yang ingin ditanyakan.`;

export function buildGraphForTemplate(template: FlowTemplateId): AutomationFlowGraph {
  if (template === "welcome_message") {
    const nodes = layoutAutomationFlowGraphVertically([
      {
        id: "start-1",
        type: "start",
        position: { x: 0, y: 0 },
        data: {
          triggerType: "incoming_message_received",
          phoneNumberIds: [],
          enrollmentFilters: [],
        },
      },
      {
        id: "send-1",
        type: "action_send_message",
        position: { x: 0, y: 120 },
        data: { body: WELCOME_MESSAGE_BODY },
      },
      {
        id: "end-1",
        type: "end",
        position: { x: 0, y: 240 },
        data: {},
      },
    ]);

    return {
      nodes,
      edges: [
        { id: "e-start-send", source: "start-1", target: "send-1" },
        { id: "e-send-end", source: "send-1", target: "end-1" },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }

  return createDefaultAutomationFlowGraph();
}

export function isFlowTemplateEnabled(template: FlowTemplateId): boolean {
  return template === "scratch" || template === "welcome_message";
}
