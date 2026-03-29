interface IntervieweesSidebarFooterProps {
  totalInterviews: number;
  selectedStatus?: string;
  totalCandidates: number;
}

export const IntervieweesSidebarFooter = ({
  totalInterviews,
  selectedStatus,
  totalCandidates
}: IntervieweesSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Candidates: {totalCandidates}</span>
        <span className="text-xs text-gray-400">Total: {totalInterviews}</span>
      </div>
    </div>
  );
};
