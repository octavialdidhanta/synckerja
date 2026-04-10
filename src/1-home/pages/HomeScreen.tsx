import { SectionMotivation } from "../components/SectionMotivation";
import { SectionProfile } from "../components/SectionProfile";
import { HomeOKRDashboard } from "../components/HomeOKRDashboard/HomeOKRDashboard";
import { OKRSectionVisibilityProvider } from "../components/HomeOKRDashboard/OKRSectionVisibilityContext";
import { SectionActivityNotifikasi } from "../components/SectionActivityNotifikasi";
import { SectionStatusKaryawan } from "../components/SectionStatusKaryawan";
import { useHomePageLoad } from "../context/HomePageLoadContext";
import { HomePageSkeleton } from "../skeletons/HomePageSkeleton";
import { cn } from "@/shared/lib/utils";

const mainScroll =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export type HomeScreenLayoutVariant = "desktop" | "mobile";

export function HomeScreen({ layoutVariant = "desktop" }: { layoutVariant?: HomeScreenLayoutVariant }) {
  const { showFullPageSkeleton } = useHomePageLoad();

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col bg-background">
      <div
        className={cn(
          "flex min-h-full min-h-0 flex-col bg-background font-sans text-foreground",
          showFullPageSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className={mainScroll}>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <div className="flex min-h-full min-h-0 flex-col">
              <div className="mb-2 mt-2 flex-shrink-0">
                <SectionMotivation />
              </div>

              {layoutVariant === "desktop" ? <HomeDesktopGrid /> : <HomeMobileStack />}

              <div className="mt-2 flex-shrink-0">
                <SectionStatusKaryawan />
              </div>
              <div className="h-4 flex-shrink-0" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-background transition-opacity duration-200 ease-out",
          showFullPageSkeleton
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        aria-hidden={!showFullPageSkeleton}
      >
        <HomePageSkeleton />
      </div>
    </div>
  );
}

function HomeDesktopGrid() {
  return (
    <div className="grid min-h-[calc(100dvh-210px)] flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
      <div className="col-span-3 flex h-full min-h-0 flex-col">
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <SectionProfile />
        </div>
      </div>

      <div className="col-span-6 flex h-full min-h-0 flex-col">
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <OKRSectionVisibilityProvider>
              <HomeOKRDashboard />
            </OKRSectionVisibilityProvider>
          </div>
        </div>
      </div>

      <div className="col-span-3 flex h-full min-h-0 flex-col">
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <SectionActivityNotifikasi standalone />
        </div>
      </div>
    </div>
  );
}

function HomeMobileStack() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 shrink-0">
        <SectionProfile />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <OKRSectionVisibilityProvider>
          <HomeOKRDashboard />
        </OKRSectionVisibilityProvider>
      </div>
      <div className="min-h-0 shrink-0">
        <SectionActivityNotifikasi standalone />
      </div>
    </div>
  );
}
