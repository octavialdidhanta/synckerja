
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Badge } from '@/shared/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import {
  useExpenseCategories,
  type CreateExpenseCategoryData,
  useExpenseTypes,
} from '@/shared/hooks/finance';
import { useForm } from 'react-hook-form';

interface ExpenseCategoryCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseCategoryChange: () => void;
}

export function ExpenseCategoryCrudModal({ isOpen, onClose, onExpenseCategoryChange }: ExpenseCategoryCrudModalProps) {
  const { expenseCategories, isLoading, isCreating, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory } = useExpenseCategories();
  const { expenseTypes } = useExpenseTypes();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpenseCategory, setEditingExpenseCategory] = useState<any>(null);

  const form = useForm<CreateExpenseCategoryData>({
    defaultValues: {
      name: '',
      description: '',
      expense_type_id: '',
    },
  });

  const handleSubmit = async (data: CreateExpenseCategoryData) => {
    let success = false;
    
    if (editingExpenseCategory) {
      success = await updateExpenseCategory(editingExpenseCategory.id, data);
    } else {
      success = await createExpenseCategory(data);
    }

    if (success) {
      form.reset();
      setIsFormOpen(false);
      setEditingExpenseCategory(null);
      onExpenseCategoryChange();
    }
  };

  const handleEdit = (expenseCategory: any) => {
    setEditingExpenseCategory(expenseCategory);
    form.setValue('name', expenseCategory.name);
    form.setValue('description', expenseCategory.description || '');
    form.setValue('expense_type_id', expenseCategory.expense_type_id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense category?')) {
      const success = await deleteExpenseCategory(id);
      if (success) {
        onExpenseCategoryChange();
      }
    }
  };

  const handleAddNew = () => {
    setEditingExpenseCategory(null);
    form.reset();
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingExpenseCategory(null);
    form.reset();
  };

  const getExpenseTypeName = (expenseTypeId: string) => {
    const expenseType = expenseTypes.find(type => type.id === expenseTypeId);
    return expenseType?.name || 'Unknown';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Expense Categories</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!isFormOpen ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Expense Categories</h3>
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
                      <TableHead>Expense Type</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          Loading expense categories...
                        </TableCell>
                      </TableRow>
                    ) : expenseCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          No expense categories found
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenseCategories.map((expenseCategory) => (
                        <TableRow key={expenseCategory.id}>
                          <TableCell className="font-medium">{expenseCategory.name}</TableCell>
                          <TableCell>{expenseCategory.description || '-'}</TableCell>
                          <TableCell>{getExpenseTypeName(expenseCategory.expense_type_id)}</TableCell>
                          <TableCell>
                            <Badge variant={expenseCategory.is_default ? 'default' : 'secondary'}>
                              {expenseCategory.is_default ? 'Default' : 'Custom'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {!expenseCategory.is_default && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  <DropdownMenuItem onClick={() => handleEdit(expenseCategory)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(expenseCategory.id)}
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
                  {editingExpenseCategory ? 'Edit Expense Category' : 'Add New Expense Category'}
                </h3>
              </div>

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Expense Type <span className="text-brand-red">*</span>
                  </label>
                  <Select 
                    onValueChange={(value) => form.setValue('expense_type_id', value)}
                    value={form.watch('expense_type_id')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Name <span className="text-brand-red">*</span>
                  </label>
                  <Input 
                    {...form.register('name', { required: true })}
                    placeholder="Enter category name"
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
                    disabled={isCreating || !form.watch('expense_type_id') || !form.watch('name')}
                  >
                    {isCreating ? 'Saving...' : editingExpenseCategory ? 'Update' : 'Create'}
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
