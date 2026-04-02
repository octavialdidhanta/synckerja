import { AlertTriangle } from "lucide-react";
import ReprimandDepartmentCard from "./ReprimandDepartmentCard";
import ReprimandTableFooter from "./ReprimandTableFooter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandData {
  id: string;
  employee_id: string;
  reprimand_type: string;
  severity_level: string;
  violation_category: string;
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  violation_description: string;
  evidence_details?: string;
  witness_names?: string;
  previous_warnings_count: number;
  corrective_action_plan?: string;
  improvement_deadline?: string;
  follow_up_date?: string;
  status: string;
  acknowledgment_required: boolean;
  employee_acknowledged: boolean;
  acknowledgment_date?: string;
  is_formal: boolean;
  impact_on_performance_review: boolean;
  notes?: string;
  document_path?: string;
  issued_by: string;
  created_at: string;
  updated_at: string;
}

interface ReprimandManagementTableProps {
  employeesByDepartment: Record<string, any[]>;
  reprimands: ReprimandData[];
  selectedDepartment: string;
  getReprimandCount: (employeeId: string) => number;
  renderReprimandBoxes: (count: number) => JSX.Element[];
  totalEmployees: number;
  totalReprimands: number;
}

export function ReprimandManagementTable({
  employeesByDepartment,
  reprimands,
  selectedDepartment,
  getReprimandCount,
  renderReprimandBoxes,
  totalEmployees,
  totalReprimands,
}: ReprimandManagementTableProps) {
  const { t } = useAppTranslation();

  // Get department list
  const departmentList = selectedDepartment === 'all' 
    ? Object.keys(employeesByDepartment)
    : [selectedDepartment];
  
  const leftColumnDepts = departmentList.filter((_, index) => index % 2 === 0);
  const rightColumnDepts = departmentList.filter((_, index) => index % 2 === 1);

  const renderDepartmentColumn = (deptList: string[]) => {
    return deptList.map((departmentName) => {
      const departmentEmployees = employeesByDepartment[departmentName] ?? [];
      
      return (
        <ReprimandDepartmentCard
          key={departmentName}
          departmentName={departmentName}
          employees={departmentEmployees}
          reprimands={reprimands}
          getReprimandCount={getReprimandCount}
          renderReprimandBoxes={renderReprimandBoxes}
        />
      );
    });
  };

  if (departmentList.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
            <h3 className="mb-2 text-lg font-medium text-foreground">
              {t("reprimands.table.emptyTitle", "No employees found")}
            </h3>
            <p className="text-muted-foreground">
              {t("reprimands.table.emptyDescription", "Add employees to start tracking reprimands.")}
            </p>
          </div>
        </div>
        <ReprimandTableFooter 
          totalEmployees={0}
          totalReprimands={0}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2">
          {/* Left Column */}
          <div className="space-y-2">
            {renderDepartmentColumn(leftColumnDepts)}
          </div>

          {/* Right Column */}
          <div className="space-y-2">
            {renderDepartmentColumn(rightColumnDepts)}
          </div>
        </div>
      </div>

      {/* Footer */}
      <ReprimandTableFooter 
        totalEmployees={totalEmployees}
        totalReprimands={totalReprimands}
      />
    </div>
  );
}

