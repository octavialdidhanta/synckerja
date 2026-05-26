import type { CSSProperties } from "react";
import { SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type SubscriptionMobileShellHeaderVariant = "overview" | "plans" | "management";

const HEADER_COPY: Record<
  SubscriptionMobileShellHeaderVariant,
  { titleKey: string; titleDefault: string; subtitleKey: string; subtitleDefault: string }
> = {
  overview: {
    titleKey: "subscription.overview.pageTitle",
    titleDefault: "Subscription Overview",
    subtitleKey: "subscription.overview.pageSubtitle",
    subtitleDefault: "Plan status and usage",
  },
  plans: {
    titleKey: "subscription.plans.title",
    titleDefault: "Subscription Plans",
    subtitleKey: "subscription.plans.description",
    subtitleDefault: "Choose the perfect plan for your organization",
  },
  management: {
    titleKey: "subscription.management.pageTitle",
    titleDefault: "Subscription Management",
    subtitleKey: "subscription.management.pageSubtitle",
    subtitleDefault: "Current plan, stats, and payment history",
  },
};

type SubscriptionMobileShellHeaderProps = {
  variant: SubscriptionMobileShellHeaderVariant;
  className?: string;
  style?: CSSProperties;
};

export function SubscriptionMobileShellHeader({
  variant,
  className,
  style,
}: SubscriptionMobileShellHeaderProps) {
  const { t } = useAppTranslation();
  const copy = HEADER_COPY[variant];

  return (
    <header
      className={
        className ??
        "safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3"
      }
      style={style}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="md:hidden shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">
            {t(copy.titleKey, copy.titleDefault)}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {t(copy.subtitleKey, copy.subtitleDefault)}
          </p>
        </div>
      </div>
      <div className="w-9 shrink-0" aria-hidden />
    </header>
  );
}
