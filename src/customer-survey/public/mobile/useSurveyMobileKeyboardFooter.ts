import { useCallback, useEffect, useMemo, useState } from "react";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";

/** Gap between keyboard top edge and sticky footer (px). */
const GAP_ABOVE_KEYBOARD = 8;

/**
 * Keeps the survey comment footer pinned above the native keyboard on mobile browsers.
 * When the keyboard closes, inset returns to 0 and layout flows normally again.
 */
export function useSurveyMobileKeyboardFooter(enabled: boolean) {
  const { height, offsetTop, isKeyboardShellOpen } = useVisualViewport();
  const [footerHeightPx, setFooterHeightPx] = useState(0);

  const keyboardActive = enabled && isKeyboardShellOpen;

  const keyboardBottomInsetPx = useMemo(() => {
    if (!keyboardActive || typeof window === "undefined") return 0;
    const inner = window.innerHeight;
    const visibleBottom = offsetTop + height;
    return Math.max(GAP_ABOVE_KEYBOARD, inner - visibleBottom);
  }, [keyboardActive, height, offsetTop]);

  useEffect(() => {
    if (!keyboardActive) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const vv = window.visualViewport;
    const lockScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    vv?.addEventListener("scroll", lockScroll);

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      vv?.removeEventListener("scroll", lockScroll);
    };
  }, [keyboardActive]);

  return {
    keyboardActive,
    keyboardBottomInsetPx,
    footerHeightPx,
    setFooterHeightPx,
  };
}
