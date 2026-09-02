import { Expand, X } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";
import { OrderProductPhoto } from "../../components/OrderProductTiles";

export function OrderItemCustomizeHero({
  photoUrl,
  name,
  onClose,
  onExpand,
}: {
  photoUrl: string | null | undefined;
  name: string;
  onClose: () => void;
  onExpand: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="relative">
      <OrderProductPhoto url={photoUrl} alt={name} className="aspect-[4/3] w-full" />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow"
        aria-label={t(ORDER_CUSTOMIZE_I18N.close, "Close")}
      >
        <X className="h-5 w-5" />
      </button>
      {photoUrl ? (
        <button
          type="button"
          onClick={onExpand}
          className="absolute right-3 top-14 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow"
          aria-label={t(ORDER_CUSTOMIZE_I18N.expandPhoto, "Expand photo")}
        >
          <Expand className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
