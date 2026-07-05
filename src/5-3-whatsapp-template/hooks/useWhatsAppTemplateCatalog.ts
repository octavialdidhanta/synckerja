import { useEffect, useMemo } from "react";
import { useWhatsAppMessageTemplates } from "./useWhatsAppMessageTemplates";
import { mapMetaTemplateToRow } from "../utils/mapMetaTemplateToRow";
import type { MetaFormFlowCatalogRow, MetaMessageTemplate, TemplateTableRow } from "../types";
import { useWhatsAppFlows } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlows";

export function useWhatsAppTemplateCatalog(whatsappAccountId: string | null, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  const tplQuery = useWhatsAppMessageTemplates(whatsappAccountId, {
    enabled: enabled && Boolean(whatsappAccountId),
  });

  useEffect(() => {
    if (!enabled || !whatsappAccountId) return;
    if (tplQuery.hasNextPage && !tplQuery.isFetchingNextPage) {
      void tplQuery.fetchNextPage();
    }
  }, [
    enabled,
    whatsappAccountId,
    tplQuery.hasNextPage,
    tplQuery.isFetchingNextPage,
    tplQuery.fetchNextPage,
  ]);

  const flowsQuery = useWhatsAppFlows();

  const messageTemplates = useMemo((): TemplateTableRow[] => {
    const pages = tplQuery.data?.pages ?? [];
    const items: MetaMessageTemplate[] = pages.flatMap((p) => p.data ?? []);
    const mapped = items.map((m) => mapMetaTemplateToRow(m)).filter((r): r is TemplateTableRow => r != null);
    const seen = new Set<string>();
    return mapped.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [tplQuery.data]);

  const flowTemplates = useMemo(
    () => messageTemplates.filter((r) => r.hasFlowButton),
    [messageTemplates],
  );

  const approvedFlowTemplates = useMemo(
    () => flowTemplates.filter((r) => r.statusRaw === "APPROVED"),
    [flowTemplates],
  );

  const formFlows = useMemo((): MetaFormFlowCatalogRow[] => {
    const flowIdToTemplate = new Map<string, TemplateTableRow>();
    for (const tpl of messageTemplates) {
      for (const flowId of tpl.linkedFlowIds) {
        if (!flowIdToTemplate.has(flowId)) flowIdToTemplate.set(flowId, tpl);
      }
    }

    return (flowsQuery.data ?? []).map((flow) => {
      const linked = flowIdToTemplate.get(flow.id);
      const isActive = flow.status === "ACTIVE";
      const linkedApproved = linked?.statusRaw === "APPROVED";
      return {
        catalogKind: "meta_form_flow" as const,
        id: flow.id,
        name: flow.name,
        status: flow.status,
        lastUpdatedAt: flow.lastUpdatedAt ? new Date(flow.lastUpdatedAt) : null,
        linkedTemplateHsmId: linked?.id ?? null,
        linkedTemplateName: linked?.templateName ?? null,
        canSendViaTemplate: Boolean(linkedApproved),
        canSendViaSession: isActive,
      };
    });
  }, [flowsQuery.data, messageTemplates]);

  const activeFormFlows = useMemo(
    () => formFlows.filter((f) => f.status === "ACTIVE"),
    [formFlows],
  );

  const isLoading = tplQuery.isLoading || flowsQuery.isPending;
  const isError = tplQuery.isError || flowsQuery.isError;
  const error = tplQuery.error ?? flowsQuery.error;

  return {
    messageTemplates,
    flowTemplates,
    approvedFlowTemplates,
    formFlows,
    activeFormFlows,
    isLoading,
    isError,
    error,
    isFetchingTemplates: tplQuery.isFetching || tplQuery.isFetchingNextPage,
  };
}
