
import { useState } from 'react';
import { MoreHorizontal, Eye, Edit, Trash2, CreditCard, History } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';

interface SalesActivitiesActionsDropdownProps {
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdatePayment: () => void;
  onCheckHistory?: () => void;
  isPaid?: boolean;
}

export const SalesActivitiesActionsDropdown = ({ 
  onViewDetails, 
  onEdit, 
  onDelete, 
  onUpdatePayment,
  onCheckHistory,
  isPaid = false
}: SalesActivitiesActionsDropdownProps) => {
  const [open, setOpen] = useState(false);

  const handleViewDetails = () => {
    onViewDetails();
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

  const handleUpdatePayment = () => {
    onUpdatePayment();
    setOpen(false);
  };

  const handleCheckHistory = () => {
    if (onCheckHistory) {
      onCheckHistory();
    }
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
        <DropdownMenuItem 
          onClick={handleEdit}
          className="cursor-pointer text-xs hover:bg-slate-50 focus:bg-slate-50"
        >
          <Edit className="h-3.5 w-3.5 mr-2" />
          Edit
        </DropdownMenuItem>
        {isPaid ? (
          <DropdownMenuItem 
            onClick={handleCheckHistory}
            className="cursor-pointer text-xs hover:bg-slate-50 focus:bg-slate-50"
          >
            <History className="h-3.5 w-3.5 mr-2" />
            Check History
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem 
            onClick={handleUpdatePayment}
            className="cursor-pointer text-xs hover:bg-slate-50 focus:bg-slate-50"
          >
            <CreditCard className="h-3.5 w-3.5 mr-2" />
            Update Payment
          </DropdownMenuItem>
        )}
        <DropdownMenuItem 
          onClick={handleDelete}
          className="cursor-pointer text-xs text-red-600 hover:bg-red-50 focus:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
