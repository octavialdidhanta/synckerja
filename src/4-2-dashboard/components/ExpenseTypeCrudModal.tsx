
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Badge } from '@/shared/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useExpenseTypes, type CreateExpenseTypeData, type UpdateExpenseTypeData } from '@/shared/hooks/finance';
import { useForm } from 'react-hook-form';

interface ExpenseTypeCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseTypeChange: () => void;
}

export function ExpenseTypeCrudModal({ isOpen, onClose, onExpenseTypeChange }: ExpenseTypeCrudModalProps) {
  const { expenseTypes, isLoading, isCreating, createExpenseType, updateExpenseType, deleteExpenseType } = useExpenseTypes();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpenseType, setEditingExpenseType] = useState<any>(null);

  const form = useForm<CreateExpenseTypeData>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const handleSubmit = async (data: CreateExpenseTypeData) => {
    try {
      if (editingExpenseType) {
        const updateData: UpdateExpenseTypeData = {
          id: editingExpenseType.id,
          name: data.name,
          description: data.description
        };
        await updateExpenseType(updateData);
      } else {
        await createExpenseType(data);
      }

      form.reset();
      setIsFormOpen(false);
      setEditingExpenseType(null);
      onExpenseTypeChange();
    } catch (error) {
      console.error('Error saving expense type:', error);
    }
  };

  const handleEdit = (expenseType: any) => {
    setEditingExpenseType(expenseType);
    form.setValue('name', expenseType.name);
    form.setValue('description', expenseType.description || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense type?')) {
      try {
        await deleteExpenseType(id);
        onExpenseTypeChange();
      } catch (error) {
        console.error('Error deleting expense type:', error);
      }
    }
  };

  const handleAddNew = () => {
    setEditingExpenseType(null);
    form.reset();
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingExpenseType(null);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Expense Types</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!isFormOpen ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Expense Types</h3>
                <Button onClick={handleAddNew} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New
                </Button>
              </div>

              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          Loading expense types...
                        </TableCell>
                      </TableRow>
                    ) : expenseTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          No expense types found
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenseTypes.map((expenseType) => (
                        <TableRow key={expenseType.id}>
                          <TableCell className="font-medium">{expenseType.name}</TableCell>
                          <TableCell>{expenseType.description || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={expenseType.is_default ? 'default' : 'secondary'}>
                              {expenseType.is_default ? 'Default' : 'Custom'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!expenseType.is_default && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => handleEdit(expenseType)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(expenseType.id)}
                                    className="text-brand-red"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  {editingExpenseType ? 'Edit Expense Type' : 'Add New Expense Type'}
                </h3>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Name <span className="text-brand-red">*</span>
                  </label>
                  <Input 
                    {...form.register('name', { required: true })}
                    placeholder="Enter expense type name"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <Textarea 
                    {...form.register('description')}
                    placeholder="Enter description (optional)"
                    className="w-full min-h-[80px] resize-none"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={handleCancelForm}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Saving...' : editingExpenseType ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
