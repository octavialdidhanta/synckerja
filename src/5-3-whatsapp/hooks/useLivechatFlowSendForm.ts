import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import type { WhatsAppAccount, WhatsAppConversation } from "../types";
import { getConversationTicketId } from "../components/inbox/ConversationList";
import { useSendWhatsAppTemplateFollowup } from "./useSendWhatsAppTemplateFollowup";
import { useSendWhatsAppFlowSession } from "./useSendWhatsAppFlowSession";
import {
  parseFollowUpSelection,
  useWhatsAppFlowFollowUpCatalog,
  type FlowFollowUpFilterMode,
} from "./useWhatsAppFlowFollowUpCatalog";
import { isOutboundBlockedForLivechat } from "../constants/leadStatus";
import { getFollowUpSendErrorMessage } from "../utils/followUpSendError";
import {
  buildLivechatFollowUpPrefill,
  slotCountForTemplateComponents,
} from "../utils/buildLivechatFollowUpPrefill";
import { useWhatsAppMessageTemplateByHsmId } from "@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplateByHsmId";
import { mapMetaTemplateToRow } from "@/5-3-whatsapp-template/utils/mapMetaTemplateToRow";
import { splitFlatParametersForPreview } from "@/5-3-whatsapp-template/utils/buildCampaignTemplateParameters";
import type { MetaMessageTemplate } from "@/5-3-whatsapp-template/types";

type AppTranslateFn = (
  key: string,
  fallback?: string,
  variables?: Record<string, string | number>,
) => string;

export type LivechatFlowSendPrefillContext = {
  customerName: string | null | undefined;
  ticketId: string | null;
  agentName: string;
  customerWaId: string | null | undefined;
};

export type UseLivechatFlowSendFormArgs = {
  open: boolean;
  conversation: WhatsAppConversation;
  waAccounts: WhatsAppAccount[];
  filterMode: FlowFollowUpFilterMode;
  t: AppTranslateFn;
  onSent?: () => void;
  successToastKey?: string;
  flowSuccessToastKey?: string;
};

export function useLivechatFlowSendForm({
  open,
  conversation,
  waAccounts,
  filterMode,
  t,
  onSent,
  successToastKey = "whatsappInbox.followUp.sent",
  flowSuccessToastKey = "whatsappInbox.followUp.flowSent",
}: UseLivechatFlowSendFormArgs) {
  const { sendFollowUp, isSendingFollowUp } = useSendWhatsAppTemplateFollowup();
  const { sendFlowSession, isSendingFlowSession } = useSendWhatsAppFlowSession();

  const matchedAccount = useMemo(() => {
    const pn = conversation.phone_number_id?.trim();
    if (!pn) return waAccounts[0] ?? null;
    return waAccounts.find((a) => a.phone_number_id === pn) ?? waAccounts[0] ?? null;
  }, [conversation.phone_number_id, waAccounts]);

  const waAccountId = matchedAccount?.id ?? null;

  const { data: conversationStatusRow } = useQuery({
    queryKey: ["whatsapp-conversation-status", conversation.id],
    enabled: open && !!conversation.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("last_inbound_at, meta_session_expires_at")
        .eq("id", conversation.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const sessionOpen = useMemo(
    () =>
      !isOutboundBlockedForLivechat({
        statusName: conversation.lead_status_name ?? null,
        metaSessionExpiresAt: conversationStatusRow?.meta_session_expires_at ?? null,
        lastInboundAt: conversationStatusRow?.last_inbound_at ?? null,
      }),
    [
      conversation.lead_status_name,
      conversationStatusRow?.meta_session_expires_at,
      conversationStatusRow?.last_inbound_at,
    ],
  );

  const catalog = useWhatsAppFlowFollowUpCatalog({
    enabled: open && !!waAccountId,
    whatsappAccountId: waAccountId,
    sessionOpen,
    filterMode,
  });

  const [selectionValue, setSelectionValue] = useState("");
  const [parameterValues, setParameterValues] = useState<string[]>([]);
  const [agentName, setAgentName] = useState("");

  const parsedSelection = useMemo(() => parseFollowUpSelection(selectionValue), [selectionValue]);
  const isSessionFlow = parsedSelection?.kind === "session_flow";
  const templateHsmId =
    parsedSelection && parsedSelection.kind !== "session_flow" ? parsedSelection.id : "";
  const selectedSessionFlow = useMemo(
    () => catalog.activeFormFlows.find((f) => f.id === parsedSelection?.id) ?? null,
    [catalog.activeFormFlows, parsedSelection?.id],
  );

  const templateDetail = useWhatsAppMessageTemplateByHsmId({
    hsmId: open && templateHsmId ? templateHsmId : null,
    whatsappAccountId: waAccountId,
  });

  const selectedMeta = templateDetail.data?.data?.[0] as MetaMessageTemplate | undefined;
  const previewRow = useMemo(() => (selectedMeta ? mapMetaTemplateToRow(selectedMeta) : null), [selectedMeta]);
  const componentsJson = useMemo(() => {
    const c = selectedMeta?.components;
    return Array.isArray(c) ? c : [];
  }, [selectedMeta?.components]);

  const ticketId = getConversationTicketId({ ...conversation, source: 'whatsapp' });

  const prefillContext = useMemo(
    (): LivechatFlowSendPrefillContext => ({
      customerName: conversation.customer_name,
      ticketId,
      agentName,
      customerWaId: conversation.customer_wa_id,
    }),
    [conversation.customer_name, conversation.customer_wa_id, ticketId, agentName],
  );

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setAgentName(profile?.full_name?.trim() || user.email || "");
    })();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectionValue("");
      setParameterValues([]);
    }
  }, [open]);

  useEffect(() => {
    const n = slotCountForTemplateComponents(componentsJson);
    if (!templateHsmId || n === 0) {
      setParameterValues([]);
      return;
    }
    setParameterValues(buildLivechatFollowUpPrefill(n, prefillContext));
  }, [templateHsmId, componentsJson, prefillContext]);

  const previewSamples = useMemo(() => {
    if (!componentsJson.length) return null;
    return splitFlatParametersForPreview(componentsJson, parameterValues);
  }, [componentsJson, parameterValues]);

  const senderLabel =
    matchedAccount?.whatsapp_business_name?.trim() ||
    matchedAccount?.display_phone_number?.trim() ||
    matchedAccount?.phone_number_id ||
    "—";

  const handleSend = useCallback(async () => {
    if (isSessionFlow) {
      if (!parsedSelection?.id) {
        toast.error(t("whatsappInbox.followUp.needTemplate", "Pilih template pesan."));
        return;
      }
      try {
        await sendFlowSession({
          conversation_id: conversation.id,
          flow_id: parsedSelection.id,
        });
        toast.success(t(flowSuccessToastKey, "Form Flow terkirim."));
        onSent?.();
      } catch (e) {
        toast.error(getFollowUpSendErrorMessage(e, t));
      }
      return;
    }
    if (!selectedMeta?.name || !selectedMeta?.language) {
      toast.error(t("whatsappInbox.followUp.needTemplate", "Pilih template pesan."));
      return;
    }
    try {
      await sendFollowUp({
        conversation_id: conversation.id,
        template_name: selectedMeta.name,
        template_language: selectedMeta.language,
        template_hsm_id: templateHsmId || null,
        template_components_json: componentsJson,
        parameter_values: parameterValues,
      });
      toast.success(t(successToastKey, "Follow-up template terkirim."));
      onSent?.();
    } catch (e) {
      toast.error(getFollowUpSendErrorMessage(e, t));
    }
  }, [
    componentsJson,
    conversation.id,
    flowSuccessToastKey,
    isSessionFlow,
    onSent,
    parameterValues,
    parsedSelection?.id,
    selectedMeta?.language,
    selectedMeta?.name,
    sendFlowSession,
    sendFollowUp,
    successToastKey,
    t,
    templateHsmId,
  ]);

  const slotCount = isSessionFlow ? 0 : slotCountForTemplateComponents(componentsJson);
  const isSending = isSessionFlow ? isSendingFlowSession : isSendingFollowUp;
  const sessionFlowOptions = catalog.pickerOptions.filter((o) => o.kind === "session_flow");
  const flowTemplateOptions = catalog.pickerOptions.filter((o) => o.kind === "flow_template");
  const otherTemplateOptions = catalog.pickerOptions.filter((o) => o.kind === "template");
  const isEmptyCatalog =
    !catalog.isLoading &&
    sessionFlowOptions.length === 0 &&
    flowTemplateOptions.length === 0 &&
    otherTemplateOptions.length === 0;

  return {
    waAccountId,
    catalog,
    sessionOpen,
    selectionValue,
    setSelectionValue,
    parameterValues,
    setParameterValues,
    senderLabel,
    previewRow,
    previewSamples,
    selectedSessionFlow,
    isSessionFlow,
    slotCount,
    isSending,
    handleSend,
    templateDetail,
    sessionFlowOptions,
    flowTemplateOptions,
    otherTemplateOptions,
    isEmptyCatalog,
    ticketId,
  };
}
