import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { useSubscriptionExpiryBanner } from "@/10-subscription/hooks/useSubscriptionExpiryBanner";
import { SubscriptionBanner } from "@/10-subscription/shared/SubscriptionBanner";

type SubscriptionExpiryBannerSlotProps = {
  className?: string;
  placement?: "inline" | "sticky";
};

export function SubscriptionExpiryBannerSlot({
  className,
  placement = "inline",
}: SubscriptionExpiryBannerSlotProps) {
  const { t } = useTranslation();
  const { visible, subscriptionStatus, canRenew } = useSubscriptionExpiryBanner();

  if (!visible || !subscriptionStatus) return null;

  return (
    <div
      role="region"
      aria-label={t("subscription.banner.a11yRegion", "Subscription expiry warning")}
      className={cn("shrink-0 border-b border-border bg-card", className)}
    >
      <SubscriptionBanner
        subscriptionStatus={subscriptionStatus}
        canRenew={canRenew}
        placement={placement}
      />
    </div>
  );
}
