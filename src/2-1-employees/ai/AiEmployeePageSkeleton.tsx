import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function AiEmployeePageSkeleton() {
  const { t } = useAppTranslation();
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={t("aiEmployee.page.loading", "Memuat karyawan AI")}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <div className="mb-2 flex-shrink-0 px-1 pt-1">
                <Skeleton className="mb-2 h-3 w-24" />
                <Skeleton className="mb-1 h-7 w-56 max-w-[80%]" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <div className="grid w-full min-w-0 flex-1 content-start grid-cols-12 items-start gap-2">
                <div className="col-span-12 flex min-w-0 flex-col gap-2 xl:col-span-8">
                  <div className="rounded-md border border-border bg-card p-3">
                    <Skeleton className="mb-3 h-4 w-32" />
                    <div className="grid grid-cols-2 gap-2">
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-card p-3">
                    <Skeleton className="mb-3 h-4 w-40" />
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-16" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-span-12 flex min-w-0 flex-col gap-2 xl:col-span-4">
                  <div className="rounded-md border border-border bg-card p-3">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <Skeleton className="h-8" />
                  </div>
                </div>
                <div className="col-span-12 flex min-w-0 flex-col gap-2">
                  <div className="rounded-md border border-border bg-card p-3">
                    <Skeleton className="mb-3 h-4 w-24" />
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-8" />
                      <Skeleton className="h-8" />
                      <Skeleton className="h-8" />
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-card p-3">
                    <Skeleton className="mb-3 h-4 w-20" />
                    <Skeleton className="h-12" />
                  </div>
                </div>
              </div>
              <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
