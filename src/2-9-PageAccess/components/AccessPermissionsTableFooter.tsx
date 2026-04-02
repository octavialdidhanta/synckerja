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
    <div className="text-muted-foreground flex items-center justify-between text-xs">
      <span className="flex items-center gap-1">
        <Settings className="h-3 w-3" />
        Total Configurations: {totalConfigurations}
      </span>
      <span className="text-muted-foreground/80 flex items-center gap-1 text-xs">
        <Calendar className="h-3 w-3" />
        Last Updated: {formattedDate}
      </span>
    </div>
  );
};

