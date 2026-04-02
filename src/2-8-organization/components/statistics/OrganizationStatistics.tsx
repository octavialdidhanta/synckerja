
import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Building2, Users, Briefcase, Crown } from 'lucide-react';

interface OrganizationStatisticsProps {
  statistics?: {
    totalEmployees: number;
    totalDepartments: number;
    totalPositions: number;
    executiveCount: number;
  };
}

export const OrganizationStatistics = ({ statistics }: OrganizationStatisticsProps) => {
  // Provide default values if statistics is undefined
  const statsData = statistics || {
    totalEmployees: 0,
    totalDepartments: 0,
    totalPositions: 0,
    executiveCount: 0,
  };

  const stats = [
    {
      title: 'Total Employees',
      value: statsData.totalEmployees,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-info-muted'
    },
    {
      title: 'Departments',
      value: statsData.totalDepartments,
      icon: Building2,
      color: 'text-success-foreground',
      bgColor: 'bg-success-muted'
    },
    {
      title: 'Job Positions',
      value: statsData.totalPositions,
      icon: Briefcase,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent'
    },
    {
      title: 'Executives',
      value: statsData.executiveCount,
      icon: Crown,
      color: 'text-warning-foreground',
      bgColor: 'bg-warning-muted'
    }
  ];

  return (
    <div className="flex shrink-0 flex-col gap-3">
      {stats.map((stat) => (
        <Card key={stat.title} className="shrink-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`shrink-0 rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
