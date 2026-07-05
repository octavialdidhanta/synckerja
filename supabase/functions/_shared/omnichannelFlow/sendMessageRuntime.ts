export type ListMessageOption = {
  id: string;
  title: string;
  description?: string;
};

export type SendMessageNodeData = {
  body?: string;
  buttonType?: string;
  listButtonText?: string;
  listSectionTitle?: string;
  listOptions?: ListMessageOption[];
  buttonAsBranch?: boolean;
};

export const LIST_BRANCH_OTHER_HANDLE = "option:other";

/** Meta delivery quirk: some generated option ids never fire webhooks; remap on send/receive. */
/** Shorter Meta row id — third quick-reply / long ids never webhook for this flow option. */
const OUTBOUND_OPTION_ID_REMAP: Record<string, string> = {
  "opt-8f836b26": "awal",
};

function inboundOptionId(replyId: string): string {
  for (const [canonical, outbound] of Object.entries(OUTBOUND_OPTION_ID_REMAP)) {
    if (replyId === outbound) return canonical;
  }
  return replyId;
}

function outboundOptionId(optionId: string): string {
  return OUTBOUND_OPTION_ID_REMAP[optionId] ?? optionId;
}

function sortOptionsForDelivery<T extends { id: string; title: string }>(options: T[]): T[] {
  return [...options].sort((a, b) => {
    const aKembali = /kembali|awal/i.test(a.title) ? 0 : 1;
    const bKembali = /kembali|awal/i.test(b.title) ? 0 : 1;
    return aKembali - bKembali;
  });
}

export const QUICK_REPLY_LIMITS = {
  maxButtons: 3,
  titleMax: 20,
} as const;

export function normalizeSendMessageData(data: Record<string, unknown> | undefined): Required<
  Pick<SendMessageNodeData, "body" | "buttonType" | "buttonAsBranch">
> & {
  listButtonText?: string;
  listSectionTitle?: string;
  listOptions: ListMessageOption[];
} {
  const rawOptions = Array.isArray(data?.listOptions) ? data!.listOptions : [];
  const listOptions: ListMessageOption[] = rawOptions
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => ({
      id: String(item.id ?? `opt-${index + 1}`),
      title: String(item.title ?? ""),
      description: item.description ? String(item.description) : undefined,
    }));

  const buttonType = String(data?.buttonType ?? "none");
  return {
    body: String(data?.body ?? ""),
    buttonType: buttonType === "list_message" ? "list_message" : buttonType === "quick_reply" ? "quick_reply" : "none",
    listButtonText: data?.listButtonText ? String(data.listButtonText) : undefined,
    listSectionTitle: data?.listSectionTitle ? String(data.listSectionTitle) : undefined,
    listOptions,
    buttonAsBranch:
      (buttonType === "list_message" || buttonType === "quick_reply") && listOptions.length > 0
        ? true
        : Boolean(data?.buttonAsBranch),
  };
}

export function isListMessageBranching(data: SendMessageNodeData | Record<string, unknown>): boolean {
  const normalized = normalizeSendMessageData(data as Record<string, unknown>);
  return normalized.buttonType === "list_message" && normalized.listOptions.length > 0;
}

export function isQuickReplyBranching(data: SendMessageNodeData | Record<string, unknown>): boolean {
  const normalized = normalizeSendMessageData(data as Record<string, unknown>);
  return normalized.buttonType === "quick_reply" && normalized.listOptions.length > 0;
}

export function isInteractiveBranching(data: SendMessageNodeData | Record<string, unknown>): boolean {
  return isListMessageBranching(data) || isQuickReplyBranching(data);
}

export function getInteractiveBranchHandles(data: SendMessageNodeData | Record<string, unknown>): string[] {
  const normalized = normalizeSendMessageData(data as Record<string, unknown>);
  if (!isInteractiveBranching(normalized)) return [];
  const optionHandles = (normalized.listOptions ?? []).map((opt) => `option:${opt.id}`);
  return [...optionHandles, LIST_BRANCH_OTHER_HANDLE];
}

export function buildWhatsAppListInteractive(data: SendMessageNodeData | Record<string, unknown>, bodyText: string) {
  const normalized = normalizeSendMessageData(data as Record<string, unknown>);
  const rows = sortOptionsForDelivery(normalized.listOptions ?? []).map((opt) => ({
    id: outboundOptionId(opt.id),
    title: opt.title.slice(0, 24),
    ...(opt.description ? { description: opt.description.slice(0, 72) } : {}),
  }));

  return {
    type: "list",
    body: { text: bodyText },
    action: {
      button: String(normalized.listButtonText ?? "Pilih Opsi").slice(0, 20),
      sections: [
        {
          ...(normalized.listSectionTitle ? { title: normalized.listSectionTitle.slice(0, 24) } : {}),
          rows,
        },
      ],
    },
  };
}

export function buildWhatsAppReplyButtonsInteractive(
  data: SendMessageNodeData | Record<string, unknown>,
  bodyText: string,
) {
  const normalized = normalizeSendMessageData(data as Record<string, unknown>);
  const options = sortOptionsForDelivery(normalized.listOptions ?? []).slice(0, QUICK_REPLY_LIMITS.maxButtons);
  return {
    type: "button",
    body: { text: bodyText.slice(0, 1024) },
    action: {
      buttons: options.map((opt) => ({
        type: "reply",
        reply: {
          id: outboundOptionId(opt.id),
          title: opt.title.slice(0, QUICK_REPLY_LIMITS.titleMax),
        },
      })),
    },
  };
}

export function resolveListBranchHandle(
  nodeData: Record<string, unknown>,
  replyId: string | null,
  replyTitle: string,
): string {
  const normalized = normalizeSendMessageData(nodeData);
  const options = normalized.listOptions ?? [];
  const canonicalReplyId = replyId ? inboundOptionId(replyId) : null;
  if (canonicalReplyId) {
    const byId = options.find((opt) => opt.id === canonicalReplyId);
    if (byId) return `option:${byId.id}`;
  }
  const titleNorm = replyTitle.trim().toLowerCase();
  const byTitle = options.find((opt) => opt.title.trim().toLowerCase() === titleNorm);
  if (byTitle) return `option:${byTitle.id}`;
  // Typed fallback when user does not tap the quick-reply/list button.
  const kembali = options.find((opt) => /kembali|awal/i.test(opt.title));
  if (kembali && /kembali|awal/i.test(titleNorm)) return `option:${kembali.id}`;
  return LIST_BRANCH_OTHER_HANDLE;
}

import {
  formatFlowResponseBody,
  parseFlowResponseJson,
} from "./mapFlowResponseToLeadSubmission.ts";

export type InboundWhatsAppExtract = {
  body: string;
  messageType: string;
  replyId: string | null;
  /** Meta WhatsApp Form Flow submission (`nfm_reply.response_json`). */
  flowResponse?: Record<string, unknown> | null;
  flowName?: string | null;
};

export function extractInboundWhatsAppBody(msg: Record<string, unknown>): InboundWhatsAppExtract {
  const msgType = String(msg.type ?? "text");
  if (msgType === "interactive") {
    const interactive = msg.interactive as Record<string, unknown> | undefined;
    const interactiveType = String(interactive?.type ?? "").toLowerCase();

    if (interactiveType === "nfm_reply") {
      const nfm = interactive?.nfm_reply as {
        response_json?: string;
        body?: string;
        name?: string;
      } | undefined;
      const responseJson = parseFlowResponseJson(nfm?.response_json);
      const flowName = nfm?.name != null ? String(nfm.name).trim() || null : null;
      const bodyFromMeta = nfm?.body != null ? String(nfm.body).trim() : "";
      const body =
        bodyFromMeta ||
        formatFlowResponseBody(responseJson, flowName);
      return {
        body,
        messageType: "nfm_reply",
        replyId: null,
        flowResponse: responseJson,
        flowName,
      };
    }

    const listReply = interactive?.list_reply as { id?: string; title?: string } | undefined;
    if (listReply?.title || listReply?.id) {
      return {
        body: String(listReply.title ?? listReply.id ?? ""),
        messageType: "list_reply",
        replyId: listReply.id ? String(listReply.id) : null,
      };
    }
    const buttonReply = interactive?.button_reply as { id?: string; title?: string } | undefined;
    if (buttonReply?.title || buttonReply?.id) {
      return {
        body: String(buttonReply.title ?? buttonReply.id ?? ""),
        messageType: "button_reply",
        replyId: buttonReply.id ? String(buttonReply.id) : null,
      };
    }
  }
  const textBody = (msg.text as { body?: string } | undefined)?.body;
  return {
    body: textBody ?? `[${msgType}]`,
    messageType: msgType,
    replyId: null,
  };
}
