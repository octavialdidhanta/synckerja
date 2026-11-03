// One Graph API version for every edge function. Override with META_GRAPH_API_VERSION;
// the default matches the frontend (src/meta-platform/constants/metaGraphVersion.ts).
// Meta supports each version for about two years, so raise this in one place.

function readVersion(): string {
  const text = (Deno.env.get("META_GRAPH_API_VERSION") ?? "").trim();
  return /^v\d+\.\d+$/.test(text) ? text : "v22.0";
}

export const META_GRAPH_VERSION = readVersion();
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
