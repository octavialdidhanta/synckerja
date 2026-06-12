import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";
import { SHARE_RECEIPT_VALIDATION_PATH } from "@/shared/native/shareReceiptValidationPath";
import { useSubscriptionExpiryBanner } from "@/10-subscription/hooks/useSubscriptionExpiryBanner";
import { SubscriptionBanner } from "@/10-subscription/shared/SubscriptionBanner";
import {
  isMobileBypassRoute,
  usesInlineSubscriptionBannerSlot,
} from "@/10-subscription/shared/subscriptionExpiryPolicy";

const BANNER_HEIGHT_CSS = "var(--subscription-banner-height, 0px)";

export function setSubscriptionBannerHeightCss(heightPx: number) {
  document.documentElement.style.setProperty("--subscription-banner-height", `${heightPx}px`);
}

export function MobileSubscriptionExpiryBannerHost() {
  const { pathname } = useLocation();
  const { isDesktop } = useAuthSurface();
  const toolsMobileViewport = useToolsModuleMobileViewport();
  const { visible, subscriptionStatus, canRenew } = useSubscriptionExpiryBanner();

  const isBypassMobile = isMobileBypassRoute(pathname, {
    isDesktop,
    toolsMobileViewport,
    shareReceiptValidationPath: SHARE_RECEIPT_VALIDATION_PATH,
  });

  const usesInlineSlot = usesInlineSubscriptionBannerSlot(pathname);
  const shouldRender = !isDesktop && isBypassMobile && visible && !usesInlineSlot && !!subscriptionStatus;

  useEffect(() => {
    if (!shouldRender) {
      setSubscriptionBannerHeightCss(0);
      return;
    }
    setSubscriptionBannerHeightCss(72);
    return () => setSubscriptionBannerHeightCss(0);
  }, [shouldRender]);

  if (!shouldRender || !subscriptionStatus) return null;

  return (
    <div
      className="fixed inset-x-0 z-[38] border-b border-border bg-card shadow-sm"
      style={{ top: "var(--safe-area-inset-top, 0px)" }}
      role="region"
      aria-live="polite"
    >
      <SubscriptionBanner subscriptionStatus={subscriptionStatus} canRenew={canRenew} placement="sticky" />
    </div>
  );
}

export { BANNER_HEIGHT_CSS };
