interface SalesActivitiesSidebarFooterProps {
  totalTypes: number;
  totalActivities: number;
}

export const SalesActivitiesSidebarFooter = ({ 
  totalTypes, 
  totalActivities 
}: SalesActivitiesSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Types: {totalTypes}</span>
        <span className="text-xs text-gray-400">Total: {totalActivities}</span>
      </div>
    </div>
  );
};









