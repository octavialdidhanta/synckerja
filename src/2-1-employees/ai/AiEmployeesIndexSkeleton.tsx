import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export function AiEmployeesIndexSkeleton() {
  const { t } = useAppTranslation();
  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={t("aiEmployee.index.loading", "Memuat karyawan AI")}
    >
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <div className="mb-1 flex flex-shrink-0 items-start justify-between gap-3 px-1 py-3">
                <div className="min-w-0">
                  <Skeleton className="mb-1 h-7 w-48" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="h-10 w-40 shrink-0" />
              </div>
              <div
                className="flex h-full min-h-[calc(100vh-150px)] flex-1 flex-col self-stretch overflow-hidden rounded-lg p-4"
                style={{
                  backgroundColor: "#ffffff",
                  backgroundImage:
                    "linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-white/80 ring-1 ring-black/10">
                  <div className="border-b border-black/10 bg-white/80 px-8 pb-3 pt-4">
                    <Skeleton className="mb-3 h-6 w-28" />
                    <div className="flex gap-2">
                      <Skeleton className="h-12 flex-1" />
                      <Skeleton className="h-12 flex-1" />
                      <Skeleton className="h-12 flex-1" />
                    </div>
                  </div>
                  <div className="flex flex-1 gap-6 px-8 py-6">
                    <Skeleton className="h-44 w-[220px]" />
                    <Skeleton className="h-44 w-[220px]" />
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
