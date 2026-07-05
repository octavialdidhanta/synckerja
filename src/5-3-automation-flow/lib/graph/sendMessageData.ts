import type { AutomationFlowSendMessageData, ListMessageOption } from "@/5-3-automation-flow/types/automationFlowGraph.types";

export const LIST_MESSAGE_LIMITS = {
  maxOptions: 10,
  listButtonTextMax: 20,
  sectionTitleMax: 24,
  optionTitleMax: 24,
  optionDescriptionMax: 72,
} as const;

export const QUICK_REPLY_LIMITS = {
  maxButtons: 3,
  titleMax: 20,
} as const;

export const LIST_BRANCH_OTHER_HANDLE = "option:other";

export function listOptionHandleId(optionId: string): string {
  return `option:${optionId}`;
}

export function normalizeSendMessageData(data: Record<string, unknown>): AutomationFlowSendMessageData {
  const buttonType = (data.buttonType as AutomationFlowSendMessageData["buttonType"]) ?? "none";
  const rawOptions = Array.isArray(data.listOptions) ? data.listOptions : [];
  const listOptions: ListMessageOption[] = rawOptions
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => ({
      id: String(item.id ?? `opt-${index + 1}`),
      title: String(item.title ?? ""),
      description: item.description ? String(item.description) : undefined,
    }));

  return {
    body: String(data.body ?? ""),
    buttonType: buttonType === "list_message" || buttonType === "quick_reply" ? buttonType : "none",
    listButtonText: data.listButtonText ? String(data.listButtonText) : undefined,
    listSectionTitle: data.listSectionTitle ? String(data.listSectionTitle) : undefined,
    listOptions,
    buttonAsBranch:
      (buttonType === "list_message" || buttonType === "quick_reply") && listOptions.length > 0
        ? true
        : Boolean(data.buttonAsBranch),
  };
}

export function shouldAutoBranchListMessage(data: AutomationFlowSendMessageData): boolean {
  return data.buttonType === "list_message" && (data.listOptions?.length ?? 0) > 0;
}

export function shouldAutoBranchQuickReply(data: AutomationFlowSendMessageData): boolean {
  return data.buttonType === "quick_reply" && (data.listOptions?.length ?? 0) > 0;
}

export function isListMessageBranching(data: AutomationFlowSendMessageData): boolean {
  return shouldAutoBranchListMessage(data);
}

export function isQuickReplyBranching(data: AutomationFlowSendMessageData): boolean {
  return shouldAutoBranchQuickReply(data);
}

export function isInteractiveBranching(data: AutomationFlowSendMessageData): boolean {
  return isListMessageBranching(data) || isQuickReplyBranching(data);
}

export function getInteractiveBranchHandles(data: AutomationFlowSendMessageData): string[] {
  if (!isInteractiveBranching(data)) return [];
  const optionHandles = (data.listOptions ?? []).map((opt) => listOptionHandleId(opt.id));
  return [...optionHandles, LIST_BRANCH_OTHER_HANDLE];
}

/** @deprecated Use getInteractiveBranchHandles */
export function getListBranchHandles(data: AutomationFlowSendMessageData): string[] {
  return getInteractiveBranchHandles(data);
}
