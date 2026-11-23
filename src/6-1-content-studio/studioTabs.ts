export const CONTENT_STUDIO_BASE = "/digital-marketing/social-media/content-studio";

export const CONTENT_STUDIO_DEFAULT_RETURN = "/digital-marketing/social-media/dashboard";

export type ContentStudioLocationState = {
  contentStudioReturnTo?: string;
};

export const STUDIO_TABS = [
  { id: "footage", label: "Footage", ready: true },
  { id: "produk", label: "Produk", ready: true },
  { id: "lokasi", label: "Lokasi", ready: true },
  { id: "shot-list", label: "Shot List", ready: true },
  { id: "referensi", label: "Referensi", ready: true },
  { id: "agent", label: "Agent", ready: true },
  { id: "pengaturan", label: "Pengaturan", ready: true },
] as const;

export type StudioTab = (typeof STUDIO_TABS)[number]["id"];

/** Tab from the last path segment; unknown or not-ready tabs fall back to Footage. */
export function studioTabFromPath(pathname: string): StudioTab {
  const seg = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  const hit = STUDIO_TABS.find((t) => t.id === seg && t.ready);
  return hit ? hit.id : "footage";
}

/** Location state to remember which Social Media page opened Content Studio. */
export function contentStudioNavState(returnTo: string): ContentStudioLocationState {
  return { contentStudioReturnTo: returnTo };
}

/**
 * Resolve the page to return to from Content Studio.
 * Falls back to Dashboard when state is missing or points at Content Studio itself.
 */
export function contentStudioReturnPath(
  state: unknown,
  fallback: string = CONTENT_STUDIO_DEFAULT_RETURN,
): string {
  const raw = (state as ContentStudioLocationState | null | undefined)?.contentStudioReturnTo;
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;
  if (raw.includes("/content-studio")) return fallback;
  if (!raw.startsWith("/digital-marketing/social-media")) return fallback;
  return raw;
}
