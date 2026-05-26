import { lazy, Suspense } from "react";
import { SectionProfile } from "../components/SectionProfile";
import { OKRSectionVisibilityProvider } from "../components/HomeOKRDashboard/OKRSectionVisibilityContext";
import { DeferredMount } from "@/shared/components/DeferredMount";
import { Skeleton } from "@/shared/components/ui/skeleton";

const HomeOKRDashboard = lazy(() =>
  import("../components/HomeOKRDashboard/HomeOKRDashboard").then((m) => ({
    default: m.HomeOKRDashboard,
  })),
);

const SectionMotivation = lazy(() =>
  import("../components/SectionMotivation").then((m) => ({
    default: m.SectionMotivation,
  })),
);

const SectionActivityNotifikasi = lazy(() =>
  import("../components/SectionActivityNotifikasi").then((m) => ({
    default: m.SectionActivityNotifikasi,
  })),
);
const SectionStatusKaryawan = lazy(() =>
  import("../components/SectionStatusKaryawan").then((m) => ({
    default: m.SectionStatusKaryawan,
  })),
);

const mainScroll =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type HomeScreenLayoutVariant = "desktop" | "mobile";

function ActivityColumnPlaceholder() {
  return (
    <div
      className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm"
      aria-hidden
    >
      <div className="flex flex-shrink-0 border-b border-border">
        <Skeleton className="m-2 h-9 flex-1 rounded-md" />
        <Skeleton className="m-2 h-9 flex-1 rounded-md" />
      </div>
      <div className="flex flex-shrink-0 flex-col gap-2 p-4 pb-2">
        <Skeleton className="h-3 w-24" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 px-4 pb-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

function StatusSectionPlaceholder() {
  return (
    <div className="grid min-h-[4.5rem] grid-cols-2 gap-2 md:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

function MotivationPlaceholder() {
  return <Skeleton className="h-[50px] w-full rounded-lg" aria-hidden />;
}

function OkrPanelPlaceholder() {
  return (
    <div
      className="flex h-full min-h-[min(70vh,520px)] flex-col gap-2 rounded-lg border border-border bg-card p-3"
      aria-hidden
    >
      <Skeleton className="h-[88px] w-full rounded-lg" />
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="min-h-[280px] flex-1 rounded-lg" />
    </div>
  );
}

/**
 * Tanpa overlay skeleton penuh di atas konten — overlay opacity menunda LCP (teks OKR tidak terhitung).
 * Loading per-section + guard/Suspense di luar route.
 */
export function HomeScreen({ layoutVariant = "desktop" }: { layoutVariant?: HomeScreenLayoutVariant }) {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background font-sans text-foreground">
      <div className={mainScroll}>
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="flex min-h-full min-h-0 flex-col">
            <div className="mb-2 mt-2 min-h-[50px] flex-shrink-0">
              <DeferredMount fallback={<MotivationPlaceholder />} idleTimeoutMs={2000} delayMs={400}>
                <Suspense fallback={<MotivationPlaceholder />}>
                  <SectionMotivation />
                </Suspense>
              </DeferredMount>
            </div>

            {layoutVariant === "desktop" ? <HomeDesktopGrid /> : <HomeMobileStack />}

            <DeferredMount fallback={<StatusSectionPlaceholder />} idleTimeoutMs={1600} delayMs={250}>
              <Suspense fallback={<StatusSectionPlaceholder />}>
                <div className="mt-2 min-h-[4.5rem] flex-shrink-0">
                  <SectionStatusKaryawan />
                </div>
              </Suspense>
            </DeferredMount>
            <div className="h-4 flex-shrink-0" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeOkrPanel() {
  return (
    <OKRSectionVisibilityProvider>
      <Suspense fallback={<OkrPanelPlaceholder />}>
        <HomeOKRDashboard />
      </Suspense>
    </OKRSectionVisibilityProvider>
  );
}

function HomeDesktopGrid() {
  return (
    <div className="grid min-h-[calc(100dvh-210px)] flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
      <div className="col-span-3 flex h-full min-h-0 flex-col">
        <SectionProfile />
      </div>

      <div className="col-span-6 flex h-full min-h-0 flex-col">
        <HomeOkrPanel />
      </div>

      <div className="col-span-3 flex h-full min-h-0 flex-col">
        <DeferredMount fallback={<ActivityColumnPlaceholder />} idleTimeoutMs={900} delayMs={80}>
          <Suspense fallback={<ActivityColumnPlaceholder />}>
            <div className="flex h-full min-h-0 min-h-[320px] flex-1 flex-col">
              <SectionActivityNotifikasi standalone />
            </div>
          </Suspense>
        </DeferredMount>
      </div>
    </div>
  );
}

function HomeMobileStack() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <SectionProfile />
      <HomeOkrPanel />
      <DeferredMount fallback={<ActivityColumnPlaceholder />} idleTimeoutMs={1200} delayMs={120}>
        <Suspense fallback={<ActivityColumnPlaceholder />}>
          <div className="min-h-[320px] shrink-0">
            <SectionActivityNotifikasi standalone />
          </div>
        </Suspense>
      </DeferredMount>
    </div>
  );
}
