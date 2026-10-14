import { Skeleton } from "@/shared/components/ui/skeleton";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import {
  CAMPAIGN_FULL_COLUMN,
  CAMPAIGN_MAIN_GRID,
  CAMPAIGN_TABLE_SECTION,
} from "@/5-3-whatsapp-template/layout/campaignLayout";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Layout mirror for `/omnichannel/campaign/instagram`. */
export function InstagramOutreachPageSkeleton() {
  const { t } = useAppTranslation();
  const label = t("instagramOutreach.loadingAria", "Memuat outreach Instagram");

  return (
    <div
      className="relative flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full min-w-0 flex-1 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <div className={CAMPAIGN_MAIN_GRID}>
                <div className={CAMPAIGN_FULL_COLUMN}>
                  <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
                    <div className={CAMPAIGN_TABLE_SECTION}>
                      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                          <div className="flex shrink-0 justify-end px-4 pt-4">
                            <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
                          </div>
                          <div className="mt-3 min-h-0 min-w-0 flex-1 space-y-2 px-3 pb-3">
                            {Array.from({ length: 8 }).map((_, index) => (
                              <Skeleton key={index} className="h-11 w-full rounded-md" />
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-40 max-w-[55%]" />
                            <Skeleton className="h-3 w-24 max-w-[40%]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
