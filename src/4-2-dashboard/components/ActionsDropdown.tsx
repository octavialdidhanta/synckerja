
import { useState } from 'react';
import { MoreHorizontal, Eye, Edit, Trash2, Banknote } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';

interface ActionsDropdownProps {
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Recurring bill Pay now (parity with mobile reminder bills). */
  showPayNow?: boolean;
  onPayNow?: () => void;
}

export const ActionsDropdown = ({
  onViewDetails,
  onEdit,
  onDelete,
  showPayNow = false,
  onPayNow,
}: ActionsDropdownProps) => {
  const [open, setOpen] = useState(false);

  const handleViewDetails = () => {
    onViewDetails();
    setOpen(false);
  };

  const handlePayNow = () => {
    onPayNow?.();
    setOpen(false);
  };

  const handleEdit = () => {
    onEdit();
    setOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-white border shadow-lg">
        <DropdownMenuItem 
          onClick={handleViewDetails}
          className="cursor-pointer text-xs hover:bg-slate-50 focus:bg-slate-50"
        >
          <Eye className="h-3.5 w-3.5 mr-2" />
          View Details
        </DropdownMenuItem>
        {showPayNow && onPayNow ? (
          <DropdownMenuItem
            onClick={handlePayNow}
            className="cursor-pointer text-xs text-brand-blue hover:bg-brand-blue/10 focus:bg-brand-blue/10"
          >
            <Banknote className="h-3.5 w-3.5 mr-2" />
            Paynow
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem 
          onClick={handleEdit}
          className="cursor-pointer text-xs hover:bg-slate-50 focus:bg-slate-50"
        >
          <Edit className="h-3.5 w-3.5 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleDelete}
          className="cursor-pointer text-xs text-brand-red hover:bg-brand-red/10 focus:bg-brand-red/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
