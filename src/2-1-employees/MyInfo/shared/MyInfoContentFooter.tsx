import { Calendar, Info } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { format } from 'date-fns';

interface MyInfoContentFooterProps {
  section: string;
  lastUpdated?: string;
}

export const MyInfoContentFooter = ({ 
  section, 
  lastUpdated 
}: MyInfoContentFooterProps) => {
  const { dateFnsLocale } = useAppTranslation();
  const currentDate = format(new Date(), "dd MMM yyyy", { locale: dateFnsLocale });

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          Section: {section}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="h-3 w-3" />
          {lastUpdated || currentDate}
        </span>
      </div>
    </div>
  );
};

