import { SYNCKERJA_BRAND_LOGO_ALT, SYNCKERJA_BRAND_LOGO_SRC } from "@/shared/brand/brandLogo";
import { cn } from "@/shared/lib/utils";

/** Match Android `splash.xml` logo slot (220dp) + splash_logo padRatio 0.14. */
export const SYNCKERJA_SPLASH_LOGO_DP = 220;

export type SynckerjaBrandMarkProps = {
  className?: string;
  /**
   * `sm` / `md` — compact chrome (nav, drawers).
   * `splash` — same box as Android splash (auth / onboarding heroes).
   */
  size?: "sm" | "md" | "splash";
};

export function SynckerjaBrandMark({ className, size = "md" }: SynckerjaBrandMarkProps) {
  if (size === "splash") {
    return (
      <div
        className={cn(
          "!box-border flex !h-[220px] !w-[220px] !max-h-[220px] !max-w-[220px] shrink-0 items-center justify-center !p-[14%] -mb-10",
          className,
        )}
      >
        <img
          src={SYNCKERJA_BRAND_LOGO_SRC}
          alt={SYNCKERJA_BRAND_LOGO_ALT}
          className="!h-full !w-full !max-h-full !max-w-full object-contain object-center"
          width={SYNCKERJA_SPLASH_LOGO_DP}
          height={SYNCKERJA_SPLASH_LOGO_DP}
          decoding="async"
        />
      </div>
    );
  }

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
