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
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          Section: {section}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {lastUpdated || currentDate}
        </span>
      </div>
    </div>
  );
};

