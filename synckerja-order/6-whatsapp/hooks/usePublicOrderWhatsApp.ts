import { useQuery } from "@tanstack/react-query";
import { fetchPublicOrderWhatsApp } from "../lib/fetchPublicOrderWhatsApp";

export const PUBLIC_ORDER_WHATSAPP_QUERY = "public-order-whatsapp";

/** Storefront: null while loading or when the outlet has no WhatsApp button. */
export function usePublicOrderWhatsApp(code: string) {
  const query = useQuery({
    queryKey: [PUBLIC_ORDER_WHATSAPP_QUERY, code],
    queryFn: () => fetchPublicOrderWhatsApp(code),
    enabled: Boolean(code),
    staleTime: 5 * 60_000,
  });
  const data = query.data;
  return data?.ok ? { phoneDigits: data.phone_digits, prefillMessage: data.prefill_message } : null;
}
