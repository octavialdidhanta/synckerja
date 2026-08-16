import { MobileContentBalanceSectionPulse } from "@/mobile/6-1-content-calendar/sections/MobileContentBalanceSection";
import { MobileFunnelSectionPulse } from "@/mobile/6-1-content-calendar/sections/MobileFunnelSection";
import { MobilePersonaSectionPulse } from "@/mobile/6-1-content-calendar/sections/persona/MobilePersonaSection";
import type { ContentCalendarTab } from "@/mobile/6-1-content-calendar/shared/contentCalendarNavPaths";

export function MobileContentCalendarBodyPulse() {
  return (
    <>
      <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-card px-3 py-3">
            <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-muted/50" />
            <div className="h-6 w-10 animate-pulse rounded bg-muted/60" />
            <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-muted/40" />
          </div>
        ))}
      </div>
      <div className="-mx-2 border-y border-border bg-card p-2">
        <div className="mb-2 grid grid-cols-2 gap-1">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted/40" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-md border border-border bg-muted/30"
            />
          ))}
        </div>
      </div>
    </>
  );
}

export function MobileContentCalendarViewSkeleton({ tab }: { tab: ContentCalendarTab }) {
  return (
    <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-1 content-padding-above-nav-default">
      {tab !== "persona" ? <div className="mx-auto h-7 w-36 animate-pulse rounded bg-muted/40" /> : null}
      {tab === "funnel" ? (
        <MobileFunnelSectionPulse />
      ) : tab === "balance" ? (
        <MobileContentBalanceSectionPulse />
      ) : tab === "persona" ? (
        <MobilePersonaSectionPulse />
      ) : (
        <MobileContentCalendarBodyPulse />
      )}
    </div>
  );
}
