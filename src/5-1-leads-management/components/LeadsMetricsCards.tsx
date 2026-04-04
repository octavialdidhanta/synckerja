
import { Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Lead } from '@/shared/types/operationsConsultant';

interface LeadsMetricsCardsProps {
  leads: Lead[];
}

export const LeadsMetricsCards = ({ leads }: LeadsMetricsCardsProps) => {
  const metrics = {
    total: leads.length,
    efektif: leads.filter(lead => lead.kategoriPasien === 'Efektif').length,
    followUp: leads.filter(lead => ['F1', 'F2', 'F3'].includes(lead.statusFollowUp)).length,
    datang: leads.filter(lead => lead.statusFollowUp === 'Datang').length
  };

  const metricsData = [
    {
      title: 'Total Leads',
      value: metrics.total,
      icon: Users,
      iconColor: 'text-brand-blue',
      iconBg: 'bg-brand-blue-soft',
      accent: 'bg-brand-blue'
    },
    {
      title: 'Follow Up',
      value: metrics.followUp,
      icon: Clock,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      accent: 'bg-amber-500'
    },
    {
      title: 'Efektif',
      value: metrics.efektif,
      icon: CheckCircle,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
      accent: 'bg-green-500'
    },
    {
      title: 'Datang',
      value: metrics.datang,
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50',
      accent: 'bg-red-500'
    }
  ];

  return (
    <>
      {metricsData.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div key={index} className="bg-white rounded-md border border-gray-200/50 p-2.5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-500 mb-0.5">{metric.title}</div>
                <div className="text-xl font-bold text-gray-900">{metric.value}</div>
                <div className="text-xs text-gray-500">
                  Leads count
                </div>
              </div>
              <div className={`p-1.5 rounded-md ${metric.iconBg} ml-2`}>
                <Icon className={`h-3.5 w-3.5 ${metric.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
