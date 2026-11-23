export const CONTENT_STUDIO_BASE = "/digital-marketing/social-media/content-studio";

export const STUDIO_TABS = [
  { id: "footage", label: "Footage", ready: true },
  { id: "produk", label: "Produk", ready: true },
  { id: "lokasi", label: "Lokasi", ready: true },
  { id: "shot-list", label: "Shot List", ready: true },
  { id: "referensi", label: "Referensi", ready: true },
] as const;

export type StudioTab = (typeof STUDIO_TABS)[number]["id"];

/** Tab from the last path segment; unknown or not-ready tabs fall back to Footage. */
export function studioTabFromPath(pathname: string): StudioTab {
  const seg = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  const hit = STUDIO_TABS.find((t) => t.id === seg && t.ready);
  return hit ? hit.id : "footage";
}
