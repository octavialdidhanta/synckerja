interface SalesActivitiesTableFooterProps {
  totalActivities: number;
  closedWonActivities: number;
  filteredActivities?: number;
  selectedStatus?: string;
}

export const SalesActivitiesTableFooter = ({ 
  totalActivities, 
  closedWonActivities, 
  filteredActivities = totalActivities,
  selectedStatus 
}: SalesActivitiesTableFooterProps) => {
  const statusText = selectedStatus && selectedStatus !== 'all' 
    ? ` in ${selectedStatus.replace('_', ' ')}` 
    : '';
    
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Showing {filteredActivities} of {totalActivities} activities{statusText}</span>
        <span className="text-xs text-gray-400">Total: {totalActivities} activities</span>
      </div>
    </div>
  );
};









