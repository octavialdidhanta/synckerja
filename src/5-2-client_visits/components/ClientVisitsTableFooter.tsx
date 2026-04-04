interface ClientVisitsTableFooterProps {
  totalVisits: number;
  completedVisits: number;
  filteredVisits?: number;
  selectedStatus?: string;
}

export const ClientVisitsTableFooter = ({ 
  totalVisits, 
  completedVisits, 
  filteredVisits = totalVisits,
  selectedStatus 
}: ClientVisitsTableFooterProps) => {
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









