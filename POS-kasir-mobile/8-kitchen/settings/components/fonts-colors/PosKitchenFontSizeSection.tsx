import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  KITCHEN_FONT_SIZES,
  type KitchenFontSize,
} from "../../lib/defaultKitchenTheme";
import { kitchenFontScale } from "../../lib/kitchenFontScale";
import { POS_KITCHEN_SETTINGS_I18N } from "../../lib/posKitchenSettingsCopy";

const LABELS: Record<KitchenFontSize, { key: string; fallback: string }> = {
  default: {
    key: POS_KITCHEN_SETTINGS_I18N.fontDefault,
    fallback: "Default",
  },
  small: { key: POS_KITCHEN_SETTINGS_I18N.fontSmall, fallback: "Small" },
  medium: { key: POS_KITCHEN_SETTINGS_I18N.fontMedium, fallback: "Medium" },
  large: { key: POS_KITCHEN_SETTINGS_I18N.fontLarge, fallback: "Large" },
};

type Props = {
  value: KitchenFontSize;
  onChange: (size: KitchenFontSize) => void;
};

export function PosKitchenFontSizeSection({ value, onChange }: Props) {
  const { t } = useAppTranslation();

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-1 text-base font-bold text-slate-900">
        {t(POS_KITCHEN_SETTINGS_I18N.fontsHeading, "Fonts")}
      </h3>
      <ul>
        {KITCHEN_FONT_SIZES.map((size) => {
          const meta = LABELS[size];
          const scale = kitchenFontScale(size);
          return (
            <li
              key={size}
              className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0"
            >
              <span
                className="font-medium leading-none text-slate-800"
                style={{ fontSize: `${scale}rem` }}
              >
                {t(meta.key, meta.fallback)}
              </span>
              <Switch
                checked={value === size}
                onCheckedChange={(checked) => {
                  if (checked) onChange(size);
                }}
                aria-label={t(meta.key, meta.fallback)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
