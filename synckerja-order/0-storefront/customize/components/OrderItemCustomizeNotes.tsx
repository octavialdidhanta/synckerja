import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";
import { ORDER_KITCHEN_NOTE_MAX } from "../lib/orderLineKitchenNote";

export function OrderItemCustomizeNotes({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useAppTranslation();
  return (
    <section className={`border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
      <p className="text-[14px] font-bold text-neutral-900">
        {t(ORDER_CUSTOMIZE_I18N.notes, "Notes")}
      </p>
      <p className="text-[12px] text-neutral-400">
        {t(ORDER_CUSTOMIZE_I18N.notesOptional, "Optional")}
      </p>
      <textarea
        value={value}
        maxLength={ORDER_KITCHEN_NOTE_MAX}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="mt-2 w-full resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-800 outline-none placeholder:italic placeholder:text-neutral-400 focus:border-neutral-400"
        placeholder={t(
          ORDER_CUSTOMIZE_I18N.notesPlaceholder,
          "Example: Make my dish delicious!",
        )}
      />
    </section>
  );
}
