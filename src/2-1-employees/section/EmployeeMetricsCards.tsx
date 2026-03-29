import React from 'react';
import { Users, UserCheck, UserX, UserPlus } from 'lucide-react';
import { countActiveEmployees, getEmployeeStatusForFilter } from '../utils/employeeUtils';

interface EmployeeMetricsCardsProps {
  employees?: any[];
  filteredEmployees?: any[];
}

export const EmployeeMetricsCards = ({ 
  employees = []
}: EmployeeMetricsCardsProps) => {
  // Calculate real metrics from employees data using consistent logic
  const totalEmployees = employees.length;
  const activeEmployees = countActiveEmployees(employees);
  
  const newHires = employees.filter(emp => {
    if (!emp.join_date) return false;
    const joinDate = new Date(emp.join_date);
    const thisMonth = new Date();
    return joinDate.getMonth() === thisMonth.getMonth() && 
           joinDate.getFullYear() === thisMonth.getFullYear();
  }).length;
  
  const terminated = employees.filter(emp => {
    const status = getEmployeeStatusForFilter(emp);
    return status === 'terminated';
  }).length;

  const statsCards = [
    {
      title: 'Total Employees',
      value: totalEmployees.toString(),
      subtitle: 'All employees',
      icon: Users,
      iconColor: 'text-brand-blue',
      bgColor: 'bg-brand-blue/10',
      borderColor: 'border-brand-blue/30'
    },
    {
      title: 'Active Employees',
      value: activeEmployees.toString(),
      subtitle: 'Currently employed',
      icon: UserCheck,
      iconColor: 'text-brand-blue-deep',
      bgColor: 'bg-brand-blue-soft',
      borderColor: 'border-brand-blue/25'
    },
    {
      title: 'New Hires',
      value: newHires.toString(),
      subtitle: 'This month',
      icon: UserPlus,
      iconColor: 'text-brand-blue-on-soft',
      bgColor: 'bg-brand-blue/15',
      borderColor: 'border-brand-blue/20'
    },
    {
      title: 'Terminated',
      value: terminated.toString(),
      subtitle: 'This month',
      icon: UserX,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded-md p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">{stat.title}</h3>
            <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
          </div>
          
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
