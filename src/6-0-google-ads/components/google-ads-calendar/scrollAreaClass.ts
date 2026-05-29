/** Hide scrollbar while keeping wheel/touch scroll (Google Ads–style picker). */
export const googleAdsScrollAreaClass =
  "scrollbar-hide overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Scroll container inside date popover (paired with googleAdsDatePopover.css). */
export const googleAdsDateScrollHostClass =
  "gads-date-scroll-host nested-scroll-touch-chain";
