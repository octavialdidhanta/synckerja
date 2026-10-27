
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
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain max-h-[168px] overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="py-6 text-center sm:py-8">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin sm:h-6 sm:w-6" />
              <p className="text-xs text-muted-foreground sm:text-sm">Loading departments...</p>
            </div>
          ) : departments.length === 0 ? (
            <div className="py-6 text-center sm:py-8">
              <p className="mb-2 text-xs text-muted-foreground sm:text-sm">No departments found</p>
              <p className="text-xs text-muted-foreground/80">
                Departments will appear when employees are assigned to them
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:gap-3">
              {departments.map((dept) => (
                <div
                  key={dept.id}
                  className="min-w-0 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted/70 sm:p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
                    <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground sm:text-base">
                      {dept.name}
                    </h4>
                    <Badge variant="outline" className="ml-0 w-fit flex-shrink-0 text-xs sm:ml-2">
                      {dept.employee_count || 0}{' '}
                      {dept.employee_count === 1 ? 'employee' : 'employees'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
