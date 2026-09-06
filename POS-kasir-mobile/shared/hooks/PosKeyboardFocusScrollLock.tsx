import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

function isTextField(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    return !["button", "checkbox", "radio", "submit", "reset", "file", "hidden", "range", "color"].includes(
      type,
    );
  }
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
}

/**
 * Android WebView + Chrome default `interactive-widget=resizes-visual` pans
 * `visualViewport.offsetTop` while `scrollY` stays 0 (jump before IME settles).
 * We opt into `resizes-content` and actively zero leftover vv pans.
 *
 * Mount once near the POS app root.
 */
export function PosKeyboardFocusScrollLock() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      const content = meta.getAttribute("content") || "";
      if (!content.includes("interactive-widget=")) {
        meta.setAttribute(
          "content",
          `${content.replace(/,\s*$/, "")}, interactive-widget=resizes-content`,
        );
      } else if (!content.includes("interactive-widget=resizes-content")) {
        meta.setAttribute(
          "content",
          content.replace(/interactive-widget=[^,\s]+/i, "interactive-widget=resizes-content"),
        );
      }
    }

    const resetScroll = (reason: string) => {
      if (!isTextField(document.activeElement)) return;
      const vv = window.visualViewport;
      const vvTop = vv ? Math.round(vv.offsetTop) : 0;
      const scrolled =
        window.scrollY !== 0 ||
        document.documentElement.scrollTop !== 0 ||
        document.body.scrollTop !== 0;
      if (!scrolled && vvTop === 0) return;

      console.warn(
        `pos-kb scroll_lock ${reason} scrollY=${Math.round(window.scrollY)} vvTop=${vvTop}`,
      );

      // Document scroll (if any).
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // Chrome sometimes parks a vv pan with scrollY=0. A one-frame scroll to
      // offsetTop then back can collapse offsetTop when resizes-content is on.
      if (vvTop > 0) {
        window.scrollTo(0, vvTop);
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };

    const onFocusIn = () => {
      resetScroll("focusin");
      requestAnimationFrame(() => resetScroll("focusin_raf"));
      window.setTimeout(() => resetScroll("focusin_50"), 50);
      window.setTimeout(() => resetScroll("focusin_150"), 150);
      window.setTimeout(() => resetScroll("focusin_350"), 350);
    };

    const onVvScroll = () => resetScroll("vv_scroll");
    const onWinScroll = () => resetScroll("win_scroll");

    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("scroll", onWinScroll, { passive: true });
    window.visualViewport?.addEventListener("scroll", onVvScroll);
    window.visualViewport?.addEventListener("resize", onVvScroll);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", onWinScroll);
      window.visualViewport?.removeEventListener("scroll", onVvScroll);
      window.visualViewport?.removeEventListener("resize", onVvScroll);
    };
  }, []);

  return null;
}
