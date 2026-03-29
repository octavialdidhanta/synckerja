interface EmployeeSidebarFooterProps {
  totalDepartments: number;
  selectedDepartment?: string;
  totalEmployees: number;
}

export const EmployeeSidebarFooter = ({ 
  totalDepartments, 
  selectedDepartment,
  totalEmployees 
}: EmployeeSidebarFooterProps) => {
  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Departments: {totalDepartments}</span>
        <span className="text-xs text-muted-foreground/80">Total: {totalEmployees}</span>
      </div>
    </div>
  );
};