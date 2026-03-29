interface EmployeeTableFooterProps {
  totalEmployees: number;
  activeEmployees: number;
  filteredEmployees?: number;
  selectedDepartment?: string;
}

export const EmployeeTableFooter = ({ 
  totalEmployees, 
  activeEmployees, 
  filteredEmployees = totalEmployees,
  selectedDepartment 
}: EmployeeTableFooterProps) => {
  const departmentText = selectedDepartment && selectedDepartment !== 'all' 
    ? ` in ${selectedDepartment}` 
    : '';
    
  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Showing {filteredEmployees} of {totalEmployees} employees{departmentText}</span>
        <span className="text-xs text-muted-foreground/80">Total: {totalEmployees} employees</span>
      </div>
    </div>
  );
};
