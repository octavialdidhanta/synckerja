import React from 'react';
import { Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface CompanyAssetsMetricsCardsProps {
  assets: any[];
}

export const CompanyAssetsMetricsCards = ({ assets }: CompanyAssetsMetricsCardsProps) => {
  const totalAssets = assets.length;
  const availableAssets = assets.filter(asset => asset.status === 'available').length;
  const inUseAssets = assets.filter(asset => asset.status === 'in-use').length;
  const maintenanceAssets = assets.filter(asset => asset.status === 'maintenance').length;

  const statsCards = [
    {
      title: 'Total Assets',
      value: totalAssets.toString(),
      subtitle: 'All assets',
      icon: Package,
      iconColor: 'text-primary',
      bgColor: 'bg-info-muted',
      borderColor: 'border-border'
    },
    {
      title: 'Available',
      value: availableAssets.toString(),
      subtitle: 'Currently available',
      icon: CheckCircle,
      iconColor: 'text-success-foreground',
      bgColor: 'bg-success-muted',
      borderColor: 'border-border'
    },
    {
      title: 'In Use',
      value: inUseAssets.toString(),
      subtitle: 'Currently in use',
      icon: Clock,
      iconColor: 'text-accent-foreground',
      bgColor: 'bg-accent',
      borderColor: 'border-border'
    },
    {
      title: 'Maintenance',
      value: maintenanceAssets.toString(),
      subtitle: 'Under maintenance',
      icon: AlertTriangle,
      iconColor: 'text-warning-foreground',
      bgColor: 'bg-warning-muted',
      borderColor: 'border-border'
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
