import type { KitchenFontSize, KitchenThemeColors } from "../../lib/defaultKitchenTheme";
import { PosKitchenColorsSection } from "./PosKitchenColorsSection";
import { PosKitchenFontSizeSection } from "./PosKitchenFontSizeSection";

type Props = {
  fontSize: KitchenFontSize;
  colors: KitchenThemeColors;
  onFontSizeChange: (size: KitchenFontSize) => void;
  onColorsChange: (colors: KitchenThemeColors) => void;
};

export function PosKitchenFontsColorsPanel({
  fontSize,
  colors,
  onFontSizeChange,
  onColorsChange,
}: Props) {
  return (
    <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
      <PosKitchenFontSizeSection value={fontSize} onChange={onFontSizeChange} />
      <PosKitchenColorsSection value={colors} onChange={onColorsChange} />
    </div>
  );
}
