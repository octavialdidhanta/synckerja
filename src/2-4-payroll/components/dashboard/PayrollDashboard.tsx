import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { DollarSign, Users, Calculator, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

export const PayrollDashboard = () => {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id;

  const { data: payrollStats, isLoading } = useQuery({
    queryKey: ['payroll-dashboard', organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return {
          totalRuns: 0,
          totalEmployees: 0,
          totalProcessed: 0,
          pendingCalculations: 0,
        };
      }

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const { data: runs } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('created_at', monthStart);

      const { count: employeeCount } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      const { data: calculations } = await supabase
        .from('employee_payroll_calculations')
        .select('id, calculation_status, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        totalRuns: runs?.length || 0,
        totalEmployees: employeeCount ?? 0,
        totalProcessed: calculations?.length || 0,
        pendingCalculations: calculations?.filter(c => c.calculation_status === 'draft').length || 0,
      };
    },
    enabled: !!organizationId,
  });

  const statCards = [
    {
      title: 'Total Employees',
      value: payrollStats?.totalEmployees || 0,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Payroll Runs This Month',
      value: payrollStats?.totalRuns || 0,
      icon: Calculator,
      color: 'bg-green-500',
    },
    {
      title: 'Processed Calculations',
      value: payrollStats?.totalProcessed || 0,
      icon: DollarSign,
      color: 'bg-purple-500',
    },
    {
      title: 'Pending Calculations',
      value: payrollStats?.pendingCalculations || 0,
      icon: Clock,
      color: 'bg-orange-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className={`${stat.color} p-2 rounded-lg mr-3`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600">{stat.title}</p>
                    <p className="text-xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
              <div className="font-medium">Create New Payroll Period</div>
              <div className="text-sm text-gray-600">Set up a new payroll cycle</div>
            </button>
            <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
              <div className="font-medium">Run Payroll Calculation</div>
              <div className="text-sm text-gray-600">Process salary calculations for employees</div>
            </button>
            <button className="w-full p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
              <div className="font-medium">Generate Payroll Report</div>
              <div className="text-sm text-gray-600">Create detailed payroll reports</div>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">Payroll calculation completed</div>
                  <div className="text-sm text-gray-600">25 employees processed</div>
                </div>
                <div className="text-sm text-gray-500">2 hours ago</div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">New payroll period created</div>
                  <div className="text-sm text-gray-600">January 2024</div>
                </div>
                <div className="text-sm text-gray-500">1 day ago</div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">Payroll report generated</div>
                  <div className="text-sm text-gray-600">December 2023 summary</div>
                </div>
                <div className="text-sm text-gray-500">3 days ago</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
