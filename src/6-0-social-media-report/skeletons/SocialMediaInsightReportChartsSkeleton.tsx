import { Skeleton } from "@/shared/components/ui/skeleton";

export function SocialMediaInsightReportChartsSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-hidden>
      <Skeleton className="h-[280px] w-full rounded-md" />
    </div>
  );
}
