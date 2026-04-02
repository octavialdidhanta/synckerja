import { useMemo } from "react";
import type { JobOpening } from "@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes";

interface RecruitmentDashboardFooterProps {
  jobOpenings?: JobOpening[];
}

export function RecruitmentDashboardFooter({ jobOpenings = [] }: RecruitmentDashboardFooterProps) {
  const summary = useMemo(() => {
    const totalJobs = jobOpenings.length;
    const activeJobs = jobOpenings.filter((job) => job.status === "active").length;
    const draftJobs = jobOpenings.filter((job) => job.status === "draft").length;
    return { totalJobs, activeJobs, draftJobs };
  }, [jobOpenings]);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Active: {summary.activeJobs} · Draft: {summary.draftJobs}
        </span>
        <span className="text-xs text-muted-foreground/80">Total: {summary.totalJobs}</span>
      </div>
    </div>
  );
}
