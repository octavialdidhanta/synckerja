import { SYNCKERJA_BRAND_LOGO_ALT, SYNCKERJA_BRAND_LOGO_SRC } from "@/shared/brand/brandLogo";
import { cn } from "@/shared/lib/utils";

export type SynckerjaBrandMarkProps = {
  className?: string;
  /** Display height cap (Tailwind scale). */
  size?: "sm" | "md";
};

export function SynckerjaBrandMark({ className, size = "md" }: SynckerjaBrandMarkProps) {
  const hClass = size === "sm" ? "max-h-10" : "max-h-[52px]";
  return (
    <img
      src={SYNCKERJA_BRAND_LOGO_SRC}
      alt={SYNCKERJA_BRAND_LOGO_ALT}
      className={cn("h-auto w-auto object-contain object-center", hClass, className)}
      width={192}
      height={192}
      decoding="async"
    />
  );
}
