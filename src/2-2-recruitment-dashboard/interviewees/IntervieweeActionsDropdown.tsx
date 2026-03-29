
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, UserPlus, Trash2, MessageSquare } from 'lucide-react';

interface IntervieweeActionsDropdownProps {
  onViewProfile: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const IntervieweeActionsDropdown = ({
  onViewProfile,
  onEdit,
  onDelete
}: IntervieweeActionsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onViewProfile}>
          <Eye className="mr-2 h-4 w-4" />
          View Profile
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onEdit}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add As Employee
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={onDelete} className="text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
        
        <DropdownMenuItem>
          <MessageSquare className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
