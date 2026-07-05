import { useMemo } from "react";
import { useApprovedWhatsAppTemplatesFlat } from "@/5-3-dashboard/omnichannel-settings/hooks/useApprovedWhatsAppTemplatesFlat";
import { useWhatsAppFlows } from "@/5-3-dashboard/omnichannel-settings/hooks/flow-builder/useWhatsAppFlows";
import type { TemplateTableRow } from "@/5-3-whatsapp-template/types";

export type FollowUpPickerOption =
  | { kind: "session_flow"; value: string; label: string; flowId: string }
  | { kind: "flow_template"; value: string; label: string; hsmId: string; row: TemplateTableRow }
  | { kind: "template"; value: string; label: string; hsmId: string; row: TemplateTableRow };

export type FlowFollowUpFilterMode = "all" | "flow_only";

export function filterFlowOnlyOptions(options: FollowUpPickerOption[]): FollowUpPickerOption[] {
  return options.filter((o) => o.kind === "session_flow" || o.kind === "flow_template");
}

export function useWhatsAppFlowFollowUpCatalog(options: {
  enabled?: boolean;
  whatsappAccountId?: string | null;
  sessionOpen?: boolean;
  filterMode?: FlowFollowUpFilterMode;
}) {
  const enabled = options.enabled ?? true;
  const sessionOpen = options.sessionOpen ?? false;
  const filterMode = options.filterMode ?? "all";

  const tplQuery = useApprovedWhatsAppTemplatesFlat({
    enabled,
    whatsappAccountId: options.whatsappAccountId,
  });

  const flowsQuery = useWhatsAppFlows();

  const approvedTemplates = tplQuery.rows;
  const flowTemplates = useMemo(
    () => approvedTemplates.filter((r) => r.hasFlowButton),
    [approvedTemplates],
  );
  const otherTemplates = useMemo(
    () => approvedTemplates.filter((r) => !r.hasFlowButton),
    [approvedTemplates],
  );

  const activeFormFlows = useMemo(
    () => (flowsQuery.data ?? []).filter((f) => f.status === "ACTIVE"),
    [flowsQuery.data],
  );

  const pickerOptions = useMemo((): FollowUpPickerOption[] => {
    const out: FollowUpPickerOption[] = [];
    if (sessionOpen) {
      for (const flow of activeFormFlows) {
        out.push({
          kind: "session_flow",
          value: `session:${flow.id}`,
          label: `${flow.name} · Flow (session)`,
          flowId: flow.id,
        });
      }
    }
    for (const row of flowTemplates) {
      out.push({
        kind: "flow_template",
        value: `template:${row.id}`,
        label: `${row.templateName} · ${row.languageLabel} · Flow template`,
        hsmId: row.id,
        row,
      });
    }
    for (const row of otherTemplates) {
      out.push({
        kind: "template",
        value: `template:${row.id}`,
        label: `${row.templateName} · ${row.languageLabel}`,
        hsmId: row.id,
        row,
      });
    }
    return out;
  }, [sessionOpen, activeFormFlows, flowTemplates, otherTemplates]);

  const filteredPickerOptions = useMemo(
    () => (filterMode === "flow_only" ? filterFlowOnlyOptions(pickerOptions) : pickerOptions),
    [filterMode, pickerOptions],
  );

  return {
    pickerOptions: filteredPickerOptions,
    flowTemplates,
    activeFormFlows,
    approvedTemplates,
    isLoading: tplQuery.isLoading || flowsQuery.isPending,
    isError: tplQuery.isError || flowsQuery.isError,
  };
}

export function parseFollowUpSelection(value: string): {
  kind: "session_flow" | "flow_template" | "template";
  id: string;
} | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("session:")) {
    return { kind: "session_flow", id: trimmed.slice("session:".length) };
  }
  if (trimmed.startsWith("template:")) {
    const id = trimmed.slice("template:".length);
    return { kind: "template", id };
  }
  return null;
}
