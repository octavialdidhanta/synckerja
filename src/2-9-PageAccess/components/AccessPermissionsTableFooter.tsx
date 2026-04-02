import { Calendar, Settings } from 'lucide-react';
import { format } from 'date-fns';

interface AccessPermissionsTableFooterProps {
  totalConfigurations: number;
  lastUpdated?: string;
}

export const AccessPermissionsTableFooter = ({ 
  totalConfigurations, 
  lastUpdated 
}: AccessPermissionsTableFooterProps) => {
  const formattedDate = lastUpdated 
    ? format(new Date(lastUpdated), 'MMM dd, yyyy HH:mm')
    : format(new Date(), 'MMM dd, yyyy HH:mm');

  return (
    <div className="flex items-center justify-between text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Settings className="h-3 w-3" />
        Total Configurations: {totalConfigurations}
      </span>
      <span className="text-xs text-gray-400 flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Last Updated: {formattedDate}
      </span>
    </div>
  );
};

