interface IntervieweesTableFooterProps {
  totalInterviews: number;
  scheduledInterviews: number;
  filteredInterviews: number;
}

export const IntervieweesTableFooter = ({
  totalInterviews,
  scheduledInterviews,
  filteredInterviews
}: IntervieweesTableFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Scheduled: {scheduledInterviews}</span>
        <span className="text-xs text-gray-400">Total: {filteredInterviews}</span>
      </div>
    </div>
  );
};
