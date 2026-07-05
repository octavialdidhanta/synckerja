const META_API_BASE = "https://graph.facebook.com/v18.0";

export const META_FLOW_DEFAULT_ENTRY_SCREEN = "FIRST_ENTRY_SCREEN";

export type MetaFlowSendMeta = {
  status: string;
  entryScreenId: string | null;
};

export async function fetchMetaFlowSendMeta(
  flowId: string,
  accessToken: string,
): Promise<MetaFlowSendMeta> {
  const statusRes = await fetch(
    `${META_API_BASE}/${encodeURIComponent(flowId)}?fields=status`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const statusJson = await statusRes.json().catch(() => ({}));
  const status = String((statusJson as { status?: string }).status ?? "").trim().toUpperCase();

  let entryScreenId: string | null = null;
  try {
    const assetsRes = await fetch(
      `${META_API_BASE}/${encodeURIComponent(flowId)}/assets`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const assetsJson = await assetsRes.json().catch(() => ({}));
    const items = (assetsJson as {
      data?: Array<{ asset_type?: string; download_url?: string }>;
    }).data ?? [];
    const flowJsonAsset = items.find(
      (a) => a.asset_type === "FLOW_JSON" && typeof a.download_url === "string" && a.download_url.trim(),
    );
    if (flowJsonAsset?.download_url) {
      const jsonRes = await fetch(flowJsonAsset.download_url);
      const flowJson = await jsonRes.json().catch(() => null) as {
        screens?: Array<{ id?: string }>;
      } | null;
      const firstId = flowJson?.screens?.[0]?.id;
      if (typeof firstId === "string" && firstId.trim()) {
        entryScreenId = firstId.trim();
      }
    }
  } catch (err) {
    console.warn("fetchMetaFlowSendMeta assets:", err);
  }

  return { status, entryScreenId };
}

/** Synckerja-built flows use this screen id; Meta Manager flows typically do not. */
export const SYNCKERJA_CUSTOM_FORM_SCREEN = "CUSTOM_FORM_SCREEN";

export function buildMetaFlowMessageParameters(args: {
  flowId: string;
  flowToken: string;
  flowCta: string;
  flowMeta: MetaFlowSendMeta;
  navigateScreen?: string;
}): Record<string, unknown> {
  const { flowId, flowToken, flowCta, flowMeta, navigateScreen } = args;
  const isDraft = flowMeta.status === "DRAFT";

  const parameters: Record<string, unknown> = {
    flow_message_version: "3",
    flow_token: flowToken,
    flow_id: flowId,
    flow_cta: flowCta,
    mode: isDraft ? "draft" : "published",
  };

  const explicitScreen = navigateScreen?.trim();
  let resolvedScreen: string | null = null;
  if (explicitScreen && explicitScreen !== SYNCKERJA_CUSTOM_FORM_SCREEN) {
    resolvedScreen = explicitScreen;
  } else if (flowMeta.entryScreenId) {
    resolvedScreen = flowMeta.entryScreenId;
  }

  if (resolvedScreen) {
    parameters.flow_action = "navigate";
    parameters.flow_action_payload = { screen: resolvedScreen };
  }

  return parameters;
}

export function formatMetaGraphError(graphJson: unknown): string {
  const err = graphJson as {
    error?: { message?: string; error_data?: { details?: string } };
  };
  return (
    err.error?.error_data?.details?.trim() ||
    err.error?.message?.trim() ||
    JSON.stringify(graphJson)
  );
}
