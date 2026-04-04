interface LeadsTableFooterProps {
  totalLeads: number;
  convertedLeads: number;
  filteredLeads?: number;
  selectedStatus?: string;
}

export const LeadsTableFooter = ({
  totalLeads,
  convertedLeads,
  filteredLeads = totalLeads,
  selectedStatus,
}: LeadsTableFooterProps) => {
  const statusText =
    selectedStatus && selectedStatus !== 'all'
      ? ` (${selectedStatus})`
      : '';

  return (
    <div className="flex-shrink-0 px-4 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
        <span>
          Showing <span className="font-medium text-gray-800">{filteredLeads}</span> of{' '}
          <span className="font-medium text-gray-800">{totalLeads}</span> leads
          {statusText}
        </span>
        <div className="flex items-center gap-4">
          <span>
            Converted: <span className="font-medium text-green-700">{convertedLeads}</span>
          </span>
          <span className="text-gray-400">Total: {totalLeads} leads</span>
        </div>
      </div>
    </div>
  );
};









