import React from 'react';
import { Users, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { NewLead } from '@/shared/types/leads';

interface LeadsMetricsCardsProps {
  leads: NewLead[];
}

export const LeadsMetricsCards = ({ leads }: LeadsMetricsCardsProps) => {
  const totalLeads = leads.length;
  const openLeads = leads.filter(lead => (lead.lead_status?.name?.trim().toLowerCase() ?? '') === 'open' || !lead.lead_status).length;
  const convertedLeads = leads.filter(lead => (lead.lead_status?.name?.trim().toLowerCase() ?? '') === 'converted').length;
  const followUpLeads = leads.filter(lead => lead.followup === 0 || lead.fu_priority === 'Please Follow Up').length;

  const statsCards = [
    {
      title: 'Total Leads',
      value: totalLeads.toString(),
      subtitle: 'All leads',
      icon: Users,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Open Leads',
      value: openLeads.toString(),
      subtitle: 'In progress',
      icon: TrendingUp,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'Converted',
      value: convertedLeads.toString(),
      subtitle: 'Successful conversions',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Follow Up Needed',
      value: followUpLeads.toString(),
      subtitle: 'Requires attention',
      icon: Clock,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded-md p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900">{stat.title}</h3>
            <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
          </div>
          
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-600">{stat.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
