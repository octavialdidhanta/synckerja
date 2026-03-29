import { Users, Calendar, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { countActiveEmployees, isEmployeeActive } from '../utils/employeeUtils';

interface EmployeeOverviewProps {
  employees?: any[];
}

export const EmployeeOverview = ({ employees = [] }: EmployeeOverviewProps) => {

  // Calculate real data from employees using consistent logic
  const activeEmployees = countActiveEmployees(employees);
  const newHiresThisMonth = employees.filter(e => {
    if (!e.join_date) return false;
    const joinDate = new Date(e.join_date);
    const thisMonth = new Date();
    return joinDate.getMonth() === thisMonth.getMonth() && 
           joinDate.getFullYear() === thisMonth.getFullYear();
  }).length;

  // Get unique departments
  const uniqueDepartments = [...new Set(employees.map(e => e.department_name).filter(Boolean))];
  const totalDepartments = uniqueDepartments.length;

  // Get top department (department with most employees)
  const departmentCounts = uniqueDepartments.map(dept => ({
    name: dept,
    count: employees.filter(e => e.department_name === dept).length
  }));
  const topDepartment = departmentCounts.reduce((max, current) => 
    current.count > max.count ? current : max, departmentCounts[0] || { name: 'N/A', count: 0 });

  // Calculate average tenure
  const now = new Date();
  const tenures = employees.map(e => {
    if (!e.join_date) return 0;
    const joinDate = new Date(e.join_date);
    return Math.floor((now.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
  }).filter(tenure => tenure > 0);
  const avgTenure = tenures.length > 0 ? tenures.reduce((sum, tenure) => sum + tenure, 0) / tenures.length : 0;

  return (
    <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border border-brand-blue/25 bg-brand-blue/10 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-blue">Active Employees</p>
                <p className="text-lg font-bold text-brand-blue-deep">{activeEmployees}</p>
              </div>
              <Users className="h-4 w-4 text-brand-blue" />
            </div>
          </div>
          
          <div className="rounded-lg border border-brand-blue/20 bg-brand-blue-soft p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-blue-on-soft">New Hires This Month</p>
                <p className="text-lg font-bold text-brand-blue-deep">{newHiresThisMonth}</p>
              </div>
              <CheckCircle className="h-4 w-4 text-brand-blue-on-soft" />
            </div>
          </div>

          <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-brand-blue">Total Departments</p>
                <p className="text-lg font-bold text-brand-blue-deep">{totalDepartments}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-brand-blue" />
            </div>
          </div>
        </div>

        {/* Top Department */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            Top Department
          </h4>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{topDepartment.name}</p>
                <p className="text-xs text-muted-foreground">{topDepartment.count} employees</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Leading</p>
                <div className="mt-1 h-2 w-2 rounded-full bg-brand-blue" />
              </div>
            </div>
          </div>
        </div>

        {/* Average Tenure */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            Average Tenure
          </h4>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{avgTenure.toFixed(1)} years</p>
                <p className="text-xs text-muted-foreground">Team experience</p>
              </div>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            Recent Activity
          </h4>
          <div className="space-y-2">
            {employees.slice(0, 3).map((employee) => (
              <div key={employee.id} className="rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">{employee.full_name}</p>
                    <p className="text-xs text-muted-foreground">{employee.department_name || 'No Department'} • {employee.job_position_name || 'No Position'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {employee.join_date ? format(new Date(employee.join_date), 'MMM dd') : 'N/A'}
                    </p>
                    <div className={`mt-1 h-2 w-2 rounded-full ${
                      isEmployeeActive(employee) ? 'bg-brand-blue' : 'bg-amber-500'
                    }`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
};
