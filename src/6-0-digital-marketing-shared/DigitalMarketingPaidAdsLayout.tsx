import { Outlet } from "react-router-dom";
import { DigitalMarketingPaidAdsProvider } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";

export function DigitalMarketingPaidAdsLayout() {
  return (
    <DigitalMarketingPaidAdsProvider>
      <Outlet />
    </DigitalMarketingPaidAdsProvider>
  );
}
