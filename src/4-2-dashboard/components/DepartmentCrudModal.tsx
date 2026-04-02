
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useDepartmentsCrud } from '@/shared/hooks/crudMaster/useDepartmentsCrud';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

interface DepartmentCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepartmentChange?: () => void;
}

export function DepartmentCrudModal({ isOpen, onClose, onDepartmentChange }: DepartmentCrudModalProps) {
  const { organizationId } = useCurrentOrg();
  const {
    data: departments,
    isLoading,
    modalOpen,
    editItem,
    openAddModal,
    openEditModal,
    closeModal,
    saveItem,
    deleteItem,
    saving
  } = useDepartmentsCrud(organizationId);

  const [departmentName, setDepartmentName] = useState('');

  const handleSave = async () => {
    if (!departmentName.trim()) {
      toast.error('Department name is required');
      return;
    }

    await saveItem(departmentName);
    setDepartmentName('');
    onDepartmentChange?.();
  };

  const handleEdit = (department: any) => {
    if (department.isDefault) {
      toast.error('Cannot edit default departments');
      return;
    }
    setDepartmentName(department.name);
    openEditModal(department);
  };

  const handleDelete = async (id: string) => {
    const department = departments?.find(d => d.id === id);
    if (department?.isDefault) {
      toast.error('Cannot delete default departments');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this department?')) {
      await deleteItem(id);
      onDepartmentChange?.();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[600px] max-w-none">
          <DialogHeader>
            <DialogTitle>Manage Departments</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={openAddModal} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Department
              </Button>
            </div>

            <div className="border rounded-lg">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-medium">Departments</h3>
              </div>
              
              <div className="max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading departments...</div>
                ) : departments && departments.length > 0 ? (
                  <div className="divide-y">
                    {departments.map((department) => (
                      <div key={department.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{department.name}</span>
                          {department.isDefault && (
                            <span className="text-xs bg-brand-blue/10 text-brand-blue px-2 py-1 rounded">Default</span>
                          )}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleEdit(department)}
                              disabled={department.isDefault}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(department.id)}
                              disabled={department.isDefault}
                              className="text-brand-red"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">No departments found</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Department Modal */}
      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="w-[400px] max-w-none">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? 'Edit Department' : 'Add New Department'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Department Name <span className="text-brand-red">*</span>
              </label>
              <Input
                value={departmentName || editItem?.name || ''}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="Enter department name"
                className="w-full"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editItem?.id ? 'Update' : 'Add'} Department
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
