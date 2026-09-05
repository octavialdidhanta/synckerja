import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_KITCHEN_NOTE_MAX } from "@/synckerja-order/0-storefront/customize/lib/orderLineKitchenNote";
import { POS_ITEM_CUSTOMIZE_I18N } from "../../lib/posItemCustomizeCopy";

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

/** Optional kitchen note for POS item customize (phone + tablet). */
export function PosLineKitchenNotesSection({ value, onChange, disabled }: Props) {
  const { t } = useAppTranslation();
  return (
    <section className="border-b border-slate-100 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {t(POS_ITEM_CUSTOMIZE_I18N.notes, "Notes")}
        </p>
        <p className="text-xs text-slate-400">
          {t(POS_ITEM_CUSTOMIZE_I18N.notesOptional, "Optional")}
        </p>
      </div>
      <textarea
        value={value}
        maxLength={ORDER_KITCHEN_NOTE_MAX}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary disabled:opacity-50"
        placeholder={t(
          POS_ITEM_CUSTOMIZE_I18N.notesPlaceholder,
          "Example: less spicy, extra sauce…",
        )}
      />
      <p className="mt-1 text-right text-[10px] tabular-nums text-slate-400">
        {value.length}/{ORDER_KITCHEN_NOTE_MAX}
      </p>
    </section>
  );
}
