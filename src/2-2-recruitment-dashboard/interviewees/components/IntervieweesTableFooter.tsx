interface IntervieweesTableFooterProps {
  totalInterviews: number;
  scheduledInterviews: number;
  filteredInterviews: number;
}

export const IntervieweesTableFooter = ({
  totalInterviews,
  scheduledInterviews,
  filteredInterviews,
}: IntervieweesTableFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {filteredInterviews} of {totalInterviews} interviewees
        </span>
        <span className="text-xs text-muted-foreground/80">
          Scheduled: {scheduledInterviews}
        </span>
      </div>
    </div>
  );
};
