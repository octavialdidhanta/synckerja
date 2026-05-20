import { createElement } from "react";

/** Canonical app logo served from `public/pwa-192.png`. */
export const SYNCKERJA_BRAND_LOGO_SRC = "/pwa-192.png";
export const SYNCKERJA_BRAND_LOGO_ALT = "Synckerja";

export type SynckerjaBrandLogoProps = {
  className?: string;
  width?: number;
  height?: number;
  /** Maps to DOM `fetchpriority` (React 18 expects lowercase on `<img>`). */
  fetchPriority?: "high" | "low" | "auto";
};

export function SynckerjaBrandLogo({
  className = "h-14 w-auto",
  width = 56,
  height = 56,
  fetchPriority,
}: SynckerjaBrandLogoProps) {
  return createElement("img", {
    src: SYNCKERJA_BRAND_LOGO_SRC,
    alt: SYNCKERJA_BRAND_LOGO_ALT,
    className,
    width,
    height,
    decoding: "async",
    ...(fetchPriority ? { fetchpriority: fetchPriority } : {}),
  });
}
