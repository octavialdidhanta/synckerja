import { ChevronRight, Menu, Search } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { orderHoursBadge } from "@/synckerja-order/shared/lib/orderHours";
import type { PublicOrderHours } from "@/synckerja-order/shared/lib/orderTypes";
import { ORDER_STOREFRONT_PX } from "../lib/orderStorefrontGutter";

type Props = {
  coverUrl: string | null | undefined;
  storeName: string;
  isOpen: boolean;
  hours: PublicOrderHours | null | undefined;
  onSearch: () => void;
  onMenu: () => void;
  onStoreInfo: () => void;
};

export function OrderStoreHero({
  coverUrl,
  storeName,
  isOpen,
  hours,
  onSearch,
  onMenu,
  onStoreInfo,
}: Props) {
  const { t } = useAppTranslation();
  const badge = orderHoursBadge({
    isOpen,
    closeHhmm: hours?.close_hhmm ?? null,
    nextOpenHhmm: hours?.next_open_hhmm ?? null,
    nextOpenIsToday: Boolean(hours?.next_open_is_today),
  });
  const badgeLabel =
    badge.kind === "open"
      ? t("synckerjaOrder.store.openBadge", "OPEN – Closes {{time}}", { time: badge.time ?? "" })
      : badge.kind === "closedToday"
        ? t("synckerjaOrder.store.closedToday", "CLOSED – Open Today {{time}}", {
            time: badge.time ?? "",
          })
        : t("synckerjaOrder.store.closedLater", "CLOSED – Opens {{time}}", {
            time: badge.time ?? "",
          });

  return (
    <div className="relative">
      <div
        className="h-[240px] overflow-hidden bg-neutral-900"
        style={{ height: 240, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full flex-col justify-end bg-gradient-to-br from-neutral-800 via-neutral-900 to-black ${ORDER_STOREFRONT_PX} pb-16`}>
            <p className="whitespace-pre-line text-[28px] font-black leading-none tracking-tight text-white">
              {t("synckerjaOrder.store.heroTitle", "NEW delicious\nMENU")}
            </p>
          </div>
        )}
      </div>
      <div className="absolute right-3 top-3 z-20 flex items-center gap-3 text-white drop-shadow">
        <button type="button" aria-label="Search" className="p-1" onClick={onSearch}>
          <Search className="h-6 w-6" strokeWidth={2} />
        </button>
        <button type="button" aria-label="Menu" className="p-1" onClick={onMenu}>
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>
      <div className={`relative z-10 ${ORDER_STOREFRONT_PX}`} style={{ marginTop: -40 }}>
        <button
          type="button"
          onClick={onStoreInfo}
          className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        >
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-neutral-900">{storeName}</span>
            <span
              className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isOpen ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
              }`}
            >
              {badgeLabel}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" />
        </button>
      </div>
    </div>
  );
}
