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
    <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Total Family Members: {totalMembers}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Last Updated: {formattedDate}
        </span>
      </div>
    </div>
  );
};

