import { SALES_OPS_CARD_FOOTER } from '@/5-2-activities/layout/salesOperationsLayout';

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
    <div className={SALES_OPS_CARD_FOOTER}>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Showing {filteredVisits} of {totalVisits} visits{statusText}</span>
        <span className="text-xs text-gray-400">Total: {totalVisits} visits</span>
      </div>
    </div>
  );
};









