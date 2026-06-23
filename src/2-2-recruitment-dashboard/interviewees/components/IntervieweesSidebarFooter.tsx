interface IntervieweesSidebarFooterProps {
  totalInterviews: number;
  selectedStatus?: string;
  totalCandidates: number;
}

export const IntervieweesSidebarFooter = ({
  totalInterviews,
  selectedStatus,
  totalCandidates,
}: IntervieweesSidebarFooterProps) => {
  const statusText =
    selectedStatus && selectedStatus !== 'all' ? ` (${selectedStatus})` : '';

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Candidates{statusText}: {totalCandidates}
        </span>
        <span className="text-xs text-muted-foreground/80">Total: {totalInterviews}</span>
      </div>
    </div>
  );
};
