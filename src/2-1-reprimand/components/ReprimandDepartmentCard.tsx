import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import ReprimandViewDropdown from "./ReprimandViewDropdown";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface Employee {
  id: string;
  full_name: string;
  job_positions?: { name: string } | null;
  profile_photo_url?: string;
  photo_url?: string;
}

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

interface ReprimandDepartmentCardProps {
  departmentName: string;
  employees: Employee[];
  reprimands: ReprimandData[];
  getReprimandCount: (employeeId: string) => number;
  renderReprimandBoxes: (count: number) => JSX.Element[];
}

function ReprimandDepartmentCard({
  departmentName,
  employees,
  reprimands,
  getReprimandCount,
  renderReprimandBoxes,
}: ReprimandDepartmentCardProps) {
  const { t } = useAppTranslation();

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="bg-gradient-to-r from-brand-red to-brand-red px-4 py-2">
        <h2 className="text-lg font-bold text-white">{departmentName}</h2>
        <p className="text-xs text-white/85">
          {t("reprimands.department.employeesCount", "{{count}} employees", { count: employees.length })}
        </p>
      </div>

      {/* Employee List */}
      <div className="p-3">
        <div className="space-y-2">
          {employees.map((employee) => {
            const reprimandCount = getReprimandCount(employee.id);
            
            return (
              <div key={employee.id} className="rounded-lg border border-border transition-colors hover:bg-brand-blue/5">
                {/* Employee Info Row - Now handled by dropdown */}
                <ReprimandViewDropdown
                  employeeId={employee.id}
                  employeeName={employee.full_name}
                  jobPosition={employee.job_positions?.name}
                  profilePhotoUrl={employee.profile_photo_url || employee.photo_url}
                  reprimandCount={reprimandCount}
                  reprimandBoxes={renderReprimandBoxes(reprimandCount)}
                  reprimands={reprimands.filter(r => r.employee_id === employee.id)}
                />

              </div>
            );
          })}
        </div>

        {employees.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm">{t("reprimands.department.emptyDepartment", "No employees in this department")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReprimandDepartmentCard;
