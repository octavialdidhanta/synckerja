interface LeadsSidebarFooterProps {
  totalLeads: number;
  convertedLeads: number;
}

export const LeadsSidebarFooter = ({ 
  totalLeads, 
  convertedLeads 
}: LeadsSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Converted: {convertedLeads}</span>
        <span className="text-xs text-gray-400">Total: {totalLeads}</span>
      </div>
    </div>
  );
};









