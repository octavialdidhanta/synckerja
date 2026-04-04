interface VisitSchedulingTableFooterProps {
  totalVisits: number;
  scheduledVisits: number;
  filteredVisits?: number;
  selectedStatus?: string;
}

export const VisitSchedulingTableFooter = ({ 
  totalVisits, 
  scheduledVisits, 
  filteredVisits = totalVisits,
  selectedStatus 
}: VisitSchedulingTableFooterProps) => {
  const statusText = selectedStatus && selectedStatus !== 'all' 
    ? ` in ${selectedStatus.replace('_', ' ')}` 
    : '';
    
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Showing {filteredVisits} of {totalVisits} visits{statusText}</span>
        <span className="text-xs text-gray-400">Total: {totalVisits} visits</span>
      </div>
    </div>
  );
};









