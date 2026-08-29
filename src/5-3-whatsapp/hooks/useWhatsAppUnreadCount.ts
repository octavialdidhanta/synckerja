import {
  useWhatsAppUnreadCountsRows,
  whatsAppUnreadTotal,
} from "./whatsappUnreadCountsShared";

const BADGE_REFETCH_MS = 30_000;

export function useWhatsAppUnreadCount() {
  const query = useWhatsAppUnreadCountsRows(BADGE_REFETCH_MS);
  const rows = query.data ?? [];

  return {
    ...query,
    data: whatsAppUnreadTotal(rows),
  };
}
