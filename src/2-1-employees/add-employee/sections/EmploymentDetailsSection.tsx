
import React from 'react';
import { EmploymentDataStepProps } from '../types';
import { useBranchesCrud } from '../../MyInfo/Employment/hooks/crudMaster/useBranchesCrud';
import { useEmployeeStatusesCrud } from '../../MyInfo/Employment/hooks/crudMaster/useEmployeeStatusesCrud';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { Button } from '@/shared/components/ui/button';
import { Plus, MoreVertical, Edit, Trash2, ChevronDown } from 'lucide-react';
import { MasterDataModal } from '@/shared/components/MasterDataModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

export const EmploymentDetailsSection = ({ formData, handleInputChange }: EmploymentDataStepProps) => {
  const { organizationId } = useCurrentOrg();
  
  const branchesCrud = useBranchesCrud(organizationId);
  const employeeStatusesCrud = useEmployeeStatusesCrud(organizationId);

  const CustomDropdown = ({ 
    label, 
    value, 
    onChange, 
    options, 
    isLoading, 
    onAdd, 
    onEdit, 
    onDelete, 
    placeholder,
    disabled 
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ id: string; name: string; isDefault?: boolean }>;
    isLoading: boolean;
    onAdd: () => void;
    onEdit: (item: { id: string; name: string; isDefault?: boolean }) => void;
    onDelete: (id: string) => void;
    placeholder: string;
    disabled?: boolean;
  }) => (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">{label} *</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="h-6 px-2 text-xs"
          disabled={disabled}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between text-sm h-10 px-3"
            disabled={isLoading || disabled}
          >
            <span className="truncate">
              {isLoading 
                ? "Loading..." 
                : value 
                ? options.find(opt => opt.id === value)?.name || placeholder
                : placeholder
              }
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[var(--radix-dropdown-menu-trigger-width)] bg-white border shadow-md">
          {!isLoading && options.map((option) => (
            <div key={option.id} className="flex items-center">
              <DropdownMenuItem
                onClick={() => onChange(option.id)}
                className="flex-1 cursor-pointer text-xs py-2 px-3"
              >
                {option.name}
                {option.isDefault && " (Default)"}
              </DropdownMenuItem>
              {!option.isDefault && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 mx-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white border shadow-md">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(option);
                      }}
                      className="text-xs"
                    >
                      <Edit className="h-3 w-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(option.id);
                      }}
                      className="text-red-600 text-xs"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {!isLoading && options.length === 0 && (
            <DropdownMenuItem disabled className="text-xs text-gray-500">
              No options available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Branch */}
        <CustomDropdown
          label="Branch"
          value={formData.branch_id || ''}
          onChange={(value) => handleInputChange('branch_id', value)}
          options={branchesCrud.data || []}
          isLoading={branchesCrud.isLoading}
          onAdd={branchesCrud.openAddModal}
          onEdit={branchesCrud.openEditModal}
          onDelete={branchesCrud.deleteItem}
          placeholder="Select branch"
        />

        {/* Employee Status */}
        <CustomDropdown
          label="Employee Status"
          value={formData.employee_status_id || ''}
          onChange={(value) => handleInputChange('employee_status_id', value)}
          options={employeeStatusesCrud.data || []}
          isLoading={employeeStatusesCrud.isLoading}
          onAdd={employeeStatusesCrud.openAddModal}
          onEdit={employeeStatusesCrud.openEditModal}
          onDelete={employeeStatusesCrud.deleteItem}
          placeholder="Select status"
        />
      </div>

      {/* Modals */}
      <MasterDataModal
        open={branchesCrud.modalOpen}
        title="Branch"
        value={branchesCrud.editItem}
        onClose={branchesCrud.closeModal}
        onSave={branchesCrud.saveItem}
        saving={branchesCrud.saving}
      />

      <MasterDataModal
        open={employeeStatusesCrud.modalOpen}
        title="Employee Status"
        value={employeeStatusesCrud.editItem}
        onClose={employeeStatusesCrud.closeModal}
        onSave={employeeStatusesCrud.saveItem}
        saving={employeeStatusesCrud.saving}
      />
    </div>
  );
};
