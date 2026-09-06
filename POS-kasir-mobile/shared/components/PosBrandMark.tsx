import { useEffect, useRef } from "react";
import { cn } from "@/shared/lib/utils";
import { posAuthFlickerLog } from "@/pos-mobile/0-auth/lib/posAuthFlickerLog";

/** POS wordmark from `public/synckerjapos.png` — phone + tablet auth surfaces only. */
export const POS_BRAND_LOGO_SRC = "/synckerjapos.png";
export const POS_BRAND_LOGO_ALT = "Synckerja POS";

/**
 * Exact slot from `android-pos/.../drawable/splash.xml`
 * (`android:width` / `android:height` = 220dp on `@drawable/splash_logo`).
 */
export const POS_SPLASH_LOGO_DP = 220;

/**
 * Same as `padRatio: 0.14` in `scripts/generate-synckerja-pos-icons.mjs` for
 * `splash_logo.png` — glyph scale matches cold-start splash.
 * `!` beats shared auth wrappers like `[&_img]:max-h-10`.
 */
const SPLASH_FRAME =
  "!box-border flex !h-[220px] !w-[220px] !max-h-[220px] !max-w-[220px] shrink-0 items-center justify-center !p-[14%]";

export type PosBrandMarkProps = {
  className?: string;
  size?: "hero" | "form";
};

/**
 * Brand mark identical in size to the POS Android splash logo (220×220 + 14% pad).
 */
export function PosBrandMark({ className }: PosBrandMarkProps) {
  const id = useRef(`brand-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    const brandId = id.current;
    posAuthFlickerLog("brand_mount", { id: brandId });
    return () => posAuthFlickerLog("brand_unmount", { id: brandId });
  }, []);

  return (
    <div className={cn(SPLASH_FRAME, "-mb-10", className)}>
      <img
        src={POS_BRAND_LOGO_SRC}
        alt={POS_BRAND_LOGO_ALT}
        className="!h-full !w-full !max-h-full !max-w-full object-contain object-center"
        width={POS_SPLASH_LOGO_DP}
        height={POS_SPLASH_LOGO_DP}
        decoding="sync"
        fetchPriority="high"
        onLoad={() => posAuthFlickerLog("brand_img_load", { id: id.current })}
        onError={() => posAuthFlickerLog("brand_img_error", { id: id.current })}
      />
    </div>
  );
}
