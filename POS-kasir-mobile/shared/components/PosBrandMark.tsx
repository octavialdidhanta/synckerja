import { cn } from "@/shared/lib/utils";

/** POS wordmark from `public/synckerjapos.png` — phone + tablet auth surfaces only. */
export const POS_BRAND_LOGO_SRC = "/synckerjapos.png";
export const POS_BRAND_LOGO_ALT = "Synckerja POS";

export type PosBrandMarkProps = {
  className?: string;
  /**
   * `hero` — welcome / login / outlet (phone + tablet).
   * `form` — denser POS auth forms (overrides shared `[&_img]:max-h-*` wrappers).
   */
  size?: "hero" | "form";
};

const SIZE_CLASS = {
  hero: "h-44 w-auto max-h-44 md:h-56 md:max-h-56",
  form: "!h-24 !w-auto !max-h-24 sm:!h-28 sm:!max-h-28",
} as const;

export function PosBrandMark({ className, size = "hero" }: PosBrandMarkProps) {
  return (
    <img
      src={POS_BRAND_LOGO_SRC}
      alt={POS_BRAND_LOGO_ALT}
      className={cn("shrink-0 object-contain object-center", SIZE_CLASS[size], className)}
      width={1008}
      height={1050}
      decoding="async"
    />
  );
}
