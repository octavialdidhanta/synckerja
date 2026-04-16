import { cn } from "@/shared/lib/utils";

const LOGO_PNG = "/pwa-512.png";

export type SynckerjaBrandMarkProps = {
  className?: string;
  /** Display height cap (Tailwind scale). */
  size?: "sm" | "md";
};

export function SynckerjaBrandMark({ className, size = "md" }: SynckerjaBrandMarkProps) {
  const hClass = size === "sm" ? "max-h-10" : "max-h-[52px]";
  return (
    <img
      src={LOGO_PNG}
      alt="Synckerja"
      className={cn("h-auto w-auto object-contain object-center", hClass, className)}
      width={512}
      height={512}
      decoding="async"
    />
  );
}
