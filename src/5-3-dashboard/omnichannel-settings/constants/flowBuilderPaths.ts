export const FLOW_BUILDER_SETTINGS_BASE_PATH = "/omnichannel/settings/flow-builder";

export const FLOW_BUILDER_LISTING_PATH = `${FLOW_BUILDER_SETTINGS_BASE_PATH}/listing`;

export const FLOW_BUILDER_USAGE_PATH = `${FLOW_BUILDER_SETTINGS_BASE_PATH}/usage`;

export const FLOW_BUILDER_FORM_FLOWS_PATH = `${FLOW_BUILDER_SETTINGS_BASE_PATH}/form-flows`;

export function metaFormFlowEditPath(flowId: string): string {
  return `${FLOW_BUILDER_FORM_FLOWS_PATH}/${encodeURIComponent(flowId)}/edit`;
}

export function parseMetaFormFlowEditId(pathname: string): string | null {
  const prefix = `${FLOW_BUILDER_FORM_FLOWS_PATH}/`;
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).replace(/\/+$/, "");
  const match = rest.match(/^([^/]+)\/edit$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export type FlowBuilderTabId = "listing" | "usage" | "form-flows";

export function parseFlowBuilderTabFromPathname(pathname: string): FlowBuilderTabId {
  if (pathname.startsWith(FLOW_BUILDER_USAGE_PATH)) return "usage";
  if (pathname.startsWith(FLOW_BUILDER_FORM_FLOWS_PATH)) return "form-flows";
  return "listing";
}

export function flowBuilderTabPath(tab: FlowBuilderTabId): string {
  if (tab === "usage") return FLOW_BUILDER_USAGE_PATH;
  if (tab === "form-flows") return FLOW_BUILDER_FORM_FLOWS_PATH;
  return FLOW_BUILDER_LISTING_PATH;
}
