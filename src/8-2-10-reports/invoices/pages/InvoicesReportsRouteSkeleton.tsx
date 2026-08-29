import { ReportsHeaderAndTab } from "../../layout/ReportsHeaderAndTab";
import { InvoicesPageSkeleton } from "./InvoicesPageSkeleton";

/** Full-route skeleton for guard + Suspense on `/operations/reports/invoices`. */
export function InvoicesReportsRouteSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans"
      aria-busy
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0">
                <ReportsHeaderAndTab />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6">
                      <InvoicesPageSkeleton />
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
