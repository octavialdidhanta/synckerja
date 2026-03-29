import { SectionMotivation } from "../components/SectionMotivation";
import { SectionProfile } from "../components/SectionProfile";
import { HomeOKRDashboard } from "../components/HomeOKRDashboard/HomeOKRDashboard";
import { OKRSectionVisibilityProvider } from "../components/HomeOKRDashboard/OKRSectionVisibilityContext";
import { SectionActivityNotifikasi } from "../components/SectionActivityNotifikasi";
import { SectionStatusKaryawan } from "../components/SectionStatusKaryawan";
import { HomePageLoadProvider, useHomePageLoad } from "../context/HomePageLoadContext";
import { ModernHomePageSkeleton } from "../components/ModernHomePageSkeleton";
import { cn } from "@/shared/lib/utils";

function ModernHomePageInner() {
  const { showFullPageSkeleton } = useHomePageLoad();

  return (
    <div className="relative flex min-h-full min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "flex min-h-full min-h-0 flex-col bg-background font-sans text-foreground",
          showFullPageSkeleton && "invisible pointer-events-none",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <div className="mb-2 mt-2 flex-shrink-0">
                <SectionMotivation />
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-12 gap-2">
                <div className="col-span-3 flex h-full min-h-0 flex-col">
                  <div className="flex h-full max-h-[calc(100vh-200px)] min-h-0 flex-col overflow-hidden seamless-scroll">
                    <SectionProfile />
                  </div>
                </div>

                <div className="col-span-6 flex h-full min-h-0 flex-col">
                  <div className="flex h-full max-h-[calc(100vh-200px)] min-h-0 flex-col overflow-hidden seamless-scroll">
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <OKRSectionVisibilityProvider>
                        <HomeOKRDashboard />
                      </OKRSectionVisibilityProvider>
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex h-full min-h-0 flex-col">
                  <div className="flex h-full max-h-[calc(100vh-200px)] min-h-0 flex-col overflow-hidden seamless-scroll">
                    <SectionActivityNotifikasi standalone />
                  </div>
                </div>
              </div>

              <div className="mt-2 flex-shrink-0">
                <SectionStatusKaryawan />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 overflow-auto bg-background">
          <ModernHomePageSkeleton />
        </div>
      ) : null}
    </div>
  );
}

function ModernHomePage() {
  return (
    <HomePageLoadProvider>
      <ModernHomePageInner />
    </HomePageLoadProvider>
  );
}

export default ModernHomePage;
