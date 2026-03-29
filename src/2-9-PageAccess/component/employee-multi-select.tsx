import React from 'react';
import Select from 'react-select';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { Label } from '@/shared/components/ui/label';
import { Loader2 } from 'lucide-react';

interface EmployeeOption {
  value: string;
  label: string;
  role?: string;
}

interface EmployeeMultiSelectProps {
  value: string[];
  onChange: (employeeIds: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const EmployeeMultiSelect: React.FC<EmployeeMultiSelectProps> = ({
  value = [],
  onChange,
  label = "Select Employees",
  placeholder = "Search and select employees...",
  disabled = false
}) => {
  const { data: employees = [], isLoading } = useEmployees();

  const employeeOptions: EmployeeOption[] = employees.map(employee => ({
    value: employee.id,
    label: `${employee.full_name} (${employee.email})`,
    role: employee.employee_status_name || 'Employee'
  }));

  const selectedOptions = employeeOptions.filter(option => 
    value.includes(option.value)
  );

  const handleChange = (selectedOptions: EmployeeOption[] | null) => {
    const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
    onChange(selectedIds);
  };

  const customStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      minHeight: '40px',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--border))',
      borderRadius: '6px',
      boxShadow: state.isFocused ? '0 0 0 2px hsl(var(--ring))' : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--border))'
      }
    }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? 'hsl(var(--primary))' 
        : state.isFocused 
        ? 'hsl(var(--muted))' 
        : 'transparent',
      color: state.isSelected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
      padding: '8px 12px'
    }),
    multiValue: (provided: any) => ({
      ...provided,
      backgroundColor: 'hsl(var(--secondary))',
      borderRadius: '4px'
    }),
    multiValueLabel: (provided: any) => ({
      ...provided,
      color: 'hsl(var(--secondary-foreground))',
      fontSize: '12px'
    }),
    multiValueRemove: (provided: any) => ({
      ...provided,
      color: 'hsl(var(--secondary-foreground))',
      ':hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'hsl(var(--destructive-foreground))'
      }
    }),
    placeholder: (provided: any) => ({
      ...provided,
      color: 'hsl(var(--muted-foreground))'
    })
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <div className="flex items-center justify-center py-8 border rounded-md">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Loading employees...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select
        isMulti
        options={employeeOptions}
        value={selectedOptions}
        onChange={handleChange}
        placeholder={placeholder}
        isDisabled={disabled}
        styles={customStyles}
        className="react-select-container"
        classNamePrefix="react-select"
        formatOptionLabel={(option: EmployeeOption) => (
          <div className="flex justify-between items-center">
            <span>{option.label}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {option.role}
            </span>
          </div>
        )}
        filterOption={(option, inputValue) =>
          option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
          (option.data as EmployeeOption).role?.toLowerCase().includes(inputValue.toLowerCase())
        }
      />
      {value.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {value.length} employee{value.length > 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  );
};