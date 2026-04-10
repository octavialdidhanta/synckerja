
import { useState } from 'react';
import { MoreHorizontal, Eye, Edit, Trash2, Banknote } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ActionsDropdownProps {
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Recurring bill Pay now (parity with mobile reminder bills). */
  showPayNow?: boolean;
  onPayNow?: () => void;
  /** e.g. mobile table: `h-10 w-10 touch-manipulation p-0` */
  triggerButtonClassName?: string;
}

export const ActionsDropdown = ({
  onViewDetails,
  onEdit,
  onDelete,
  showPayNow = false,
  onPayNow,
  triggerButtonClassName,
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
        <Button variant="ghost" size="sm" className={cn('h-6 w-6 p-0', triggerButtonClassName)}>
          <MoreHorizontal className={triggerButtonClassName ? 'h-4 w-4' : 'h-3 w-3'} />
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
