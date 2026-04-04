import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { SalesActivityItem } from '@/shared/hooks/organized/sales';

interface ItemsTableProps {
  items: SalesActivityItem[];
  loading: boolean;
  onEdit: (item: SalesActivityItem) => void;
  onDelete: (itemId: string) => void;
}

export const ItemsTable = ({ items, loading, onEdit, onDelete }: ItemsTableProps) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading items...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No items added yet. Click "Add Item" to get started.</p>
      </div>
    );
  }

  const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Sub Service</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Unit Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.service_name}
              </TableCell>
              <TableCell>
                {item.sub_service_name || '-'}
              </TableCell>
              <TableCell className="text-right">
                {item.quantity}
              </TableCell>
              <TableCell className="text-right">
                Rp {item.unit_price.toLocaleString('id-ID')}
              </TableCell>
              <TableCell className="text-right font-medium">
                Rp {item.total_price.toLocaleString('id-ID')}
              </TableCell>
              <TableCell>
                {item.notes || '-'}
              </TableCell>
              <TableCell>
                <div className="flex space-x-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Total Amount Summary */}
      <div className="flex justify-end">
        <div className="bg-muted p-4 rounded-lg">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold">
              Rp {totalAmount.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
