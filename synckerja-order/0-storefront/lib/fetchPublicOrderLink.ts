import { supabase } from "@/shared/lib/supabaseClient";
import { isValidPublicCode, normalizePublicCode } from "@/synckerja-order/shared/lib/publicCode";

export type PublicOrderLinkSettings = {
  link_ordering_enabled: boolean;
  maps_url: string | null;
};

/** Storefront: whether the advertising link may show add-to-cart. Checkout stays off. */
export async function fetchPublicOrderLink(code: string): Promise<PublicOrderLinkSettings> {
  const { data, error } = await supabase.rpc("get_public_synckerja_order_link", {
    p_code: normalizePublicCode(code),
  });
  if (error || !data || typeof data !== "object") {
    return { link_ordering_enabled: false, maps_url: null };
  }
  const payload = data as { link_ordering_enabled?: boolean; maps_url?: string | null };
  const mapsUrl = typeof payload.maps_url === "string" ? payload.maps_url.trim() : "";
  return {
    link_ordering_enabled: payload.link_ordering_enabled === true,
    maps_url: mapsUrl || null,
  };
}

export type PublicOrderBranch = {
  name: string;
  address: string | null;
  public_code: string;
};

/** Other enabled outlets in the same business. The current outlet is omitted. */
export async function fetchPublicOrderBranches(code: string): Promise<PublicOrderBranch[]> {
  const { data, error } = await supabase.rpc("get_public_synckerja_order_branches", {
    p_code: normalizePublicCode(code),
  });
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { name?: unknown; address?: unknown; public_code?: unknown };
    const publicCode = typeof item.public_code === "string" ? normalizePublicCode(item.public_code) : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!isValidPublicCode(publicCode) || !name) return [];
    const address = typeof item.address === "string" ? item.address.trim() : "";
    return [{ name, address: address || null, public_code: publicCode }];
  });
}
