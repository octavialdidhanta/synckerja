import { X } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";

export function OrderItemPhotoLightbox({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-800"
        aria-label={t(ORDER_CUSTOMIZE_I18N.close, "Close")}
      >
        <X className="h-5 w-5" />
      </button>
      <button type="button" className="flex h-full w-full items-center justify-center" onClick={onClose}>
        <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
      </button>
    </div>
  );
}
