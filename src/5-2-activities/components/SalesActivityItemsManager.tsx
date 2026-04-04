import React, { useState, useImperativeHandle } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Plus } from 'lucide-react';
import { AddItemDialog } from './AddItemDialog';
import { ItemsTable } from './ItemsTable';
import { useSalesActivityItems, CreateSalesActivityItemData, SalesActivityItem } from '@/shared/hooks/organized/sales';
import { useToast } from '@/shared/components/ui/use-toast';
import { devLog } from '@/shared/lib/logger';

interface SalesActivityItemsManagerProps {
  salesActivityId?: string;
  onTotalChange?: (total: number) => void;
}

export interface SalesActivityItemsManagerHandle {
  getDraftPayloads: () => CreateSalesActivityItemData[];
  clearDrafts: () => void;
}

export const SalesActivityItemsManager = React.forwardRef<SalesActivityItemsManagerHandle, SalesActivityItemsManagerProps>(({ salesActivityId, onTotalChange }, ref) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<SalesActivityItem | null>(null);
  const [draftItems, setDraftItems] = useState<SalesActivityItem[]>([]);
  const { toast } = useToast();

  const {
    items,
    loading,
    createItem,
    updateItem,
    deleteItem,
    getTotalAmount,
  } = useSalesActivityItems(salesActivityId);
  const lastSyncedForIdRef = React.useRef<string | null>(null);

  // Combine saved items and draft items for display
  const allItems = [...items, ...draftItems];

  // Calculate total including draft items
  const calculateTotalWithDrafts = () => {
    const savedTotal = getTotalAmount();
    const draftTotal = draftItems.reduce((total, item) => total + item.total_price, 0);
    return savedTotal + draftTotal;
  };

  // Notify parent component of total changes
  React.useEffect(() => {
    if (onTotalChange) {
      onTotalChange(calculateTotalWithDrafts());
    }
  }, [items, draftItems, onTotalChange, getTotalAmount]);

  // Sync draft items to database exactly once when salesActivityId becomes available
  React.useEffect(() => {
    if (!salesActivityId || draftItems.length === 0) return;

    // Prevent re-sync loops on re-renders
    if (lastSyncedForIdRef.current === salesActivityId) return;
    lastSyncedForIdRef.current = salesActivityId;

    const payloads = draftItems.map((draftItem) => ({
      service_id: draftItem.service_id,
      sub_service_id: draftItem.sub_service_id,
      service_name: draftItem.service_name,
      sub_service_name: draftItem.sub_service_name,
      quantity: draftItem.quantity,
      unit_price: draftItem.unit_price,
      notes: draftItem.notes,
    }));

    const sync = async () => {
      try {
        await Promise.all(payloads.map((p) => createItem(p)));
        setDraftItems([]);
        toast({
          title: "Success",
          description: "Draft items have been saved to the database",
        });
      } catch (error) {
        devLog.error('Failed to sync draft items:', error);
        toast({
          title: "Error",
          description: "Failed to save draft items.",
          variant: "destructive",
        });
      }
    };

    sync();
    // Depend only on stable values to avoid repeated runs
  }, [salesActivityId, draftItems.length]);

  const handleAddItem = async (data: CreateSalesActivityItemData) => {
    if (salesActivityId) {
      // Save directly to database
      try {
        await createItem(data);
        toast({
          title: "Success",
          description: "Item added successfully",
        });
      } catch (error) {
        // Error handling is done in the hook
      }
    } else {
      // Save as draft
      const draftItem: SalesActivityItem = {
        id: `draft_${Date.now()}`,
        sales_activity_id: '',
        organization_id: '',
        service_id: data.service_id,
        sub_service_id: data.sub_service_id,
        service_name: data.service_name,
        sub_service_name: data.sub_service_name,
        quantity: data.quantity,
        unit_price: data.unit_price,
        total_price: data.quantity * data.unit_price,
        notes: data.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setDraftItems(prev => [...prev, draftItem]);
      toast({
        title: "Success",
        description: "Item added as draft",
      });
    }
  };

  const handleEditItem = async (data: CreateSalesActivityItemData) => {
    if (!editingItem) return;
    
    if (editingItem.id.startsWith('draft_')) {
      // Update draft item
      const updatedDraftItem: SalesActivityItem = {
        ...editingItem,
        service_id: data.service_id,
        sub_service_id: data.sub_service_id,
        service_name: data.service_name,
        sub_service_name: data.sub_service_name,
        quantity: data.quantity,
        unit_price: data.unit_price,
        total_price: data.quantity * data.unit_price,
        notes: data.notes,
        updated_at: new Date().toISOString(),
      };
      
      setDraftItems(prev => prev.map(item => 
        item.id === editingItem.id ? updatedDraftItem : item
      ));
      
      toast({
        title: "Success",
        description: "Draft item updated successfully",
      });
    } else {
      // Update saved item (pass single object { id, ...data } for mutation)
      try {
        await updateItem({ id: editingItem.id, ...data });
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      } catch (error) {
        // Error handling is done in the hook
      }
    }
    setEditingItem(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    if (itemId.startsWith('draft_')) {
      // Delete draft item
      setDraftItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: "Success",
        description: "Draft item deleted successfully",
      });
    } else {
      // Delete saved item
      try {
        await deleteItem(itemId);
        toast({
          title: "Success",
          description: "Item deleted successfully",
        });
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };

  const handleEdit = (item: SalesActivityItem) => {
    setEditingItem(item);
    setShowAddDialog(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setShowAddDialog(open);
    if (!open) setEditingItem(null);
  };

  // Expose draft helpers to parent (for syncing after creating activity)
  useImperativeHandle(ref, () => ({
    getDraftPayloads: () =>
      draftItems.map((draftItem) => ({
        service_id: draftItem.service_id,
        sub_service_id: draftItem.sub_service_id,
        service_name: draftItem.service_name,
        sub_service_name: draftItem.sub_service_name,
        quantity: draftItem.quantity,
        unit_price: draftItem.unit_price,
        notes: draftItem.notes,
      })),
    clearDrafts: () => setDraftItems([]),
  }));

  return (
    <Card className="min-w-0 rounded-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Item Details</CardTitle>
          <Button
            type="button"
            onClick={() => setShowAddDialog(true)}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-x-auto">
        <ItemsTable
          items={allItems}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDeleteItem}
        />
      </CardContent>

      <AddItemDialog
        open={showAddDialog}
        onOpenChange={(open) => handleCloseDialog(open)}
        onSubmit={editingItem ? handleEditItem : handleAddItem}
        editingItem={editingItem}
      />
    </Card>
  );
});
