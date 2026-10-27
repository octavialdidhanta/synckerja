import { Users, Info } from 'lucide-react';

interface FamilyTableFooterProps {
  totalMembers: number;
  lastUpdated?: string;
}

export const FamilyTableFooter = ({ 
  totalMembers,
  lastUpdated 
}: FamilyTableFooterProps) => {
  const formattedDate = lastUpdated 
    ? new Date(lastUpdated).toLocaleDateString('id-ID', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    : 'Not available';

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-1.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Total Family Members: {totalMembers}
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Info className="h-3 w-3" />
          Last Updated: {formattedDate}
        </span>
      </div>
    </div>
  );
};

