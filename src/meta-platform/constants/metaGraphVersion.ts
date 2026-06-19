/** Graph API version for Meta platform client calls (match edge META_GRAPH_API_VERSION). */
export const META_GRAPH_VERSION =
  (import.meta.env.VITE_META_GRAPH_API_VERSION as string | undefined)?.trim() || 'v22.0';
