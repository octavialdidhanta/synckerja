
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  employee_count?: number;
}

interface CompanyDepartmentsProps {
  departments: Department[];
  isLoading?: boolean;
}

export const CompanyDepartments = ({ departments, isLoading = false }: CompanyDepartmentsProps) => {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 pb-3">
        <CardTitle className="text-lg sm:text-xl font-semibold truncate">Departments</CardTitle>
        <Badge variant="secondary" className="text-xs whitespace-nowrap w-fit">
          from employee data
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 sm:py-8">
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin mx-auto mb-2" />
            <p className="text-xs sm:text-sm text-muted-foreground">Loading departments...</p>
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">No departments found</p>
            <p className="text-xs text-muted-foreground/80">
              Departments will appear when employees are assigned to them
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {departments.map((dept) => (
              <div key={dept.id} className="p-3 sm:p-4 border border-border rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors min-w-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
                  <h4 className="text-sm sm:text-base font-medium text-foreground truncate min-w-0 flex-1">{dept.name}</h4>
                  <Badge variant="outline" className="ml-0 sm:ml-2 w-fit flex-shrink-0 text-xs">
                    {dept.employee_count || 0} {dept.employee_count === 1 ? 'employee' : 'employees'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
