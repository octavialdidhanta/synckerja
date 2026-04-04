interface ClientVisitsSidebarFooterProps {
  totalStatuses: number;
  totalVisits: number;
}

export const ClientVisitsSidebarFooter = ({ 
  totalStatuses, 
  totalVisits 
}: ClientVisitsSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Statuses: {totalStatuses}</span>
        <span className="text-xs text-gray-400">Total: {totalVisits}</span>
      </div>
    </div>
  );
};









