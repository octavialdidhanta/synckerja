import React from "react";
import { Users, TrendingUp, Target, DollarSign } from "lucide-react";

import type { KOLMetrics } from "../hooks/useKOLManagementData";

interface KOLManagementMetricsCardsProps {
  metrics: KOLMetrics | null;
  isLoading?: boolean;
}

export const KOLManagementMetricsCards = ({ metrics, isLoading }: KOLManagementMetricsCardsProps) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (isLoading || !metrics) {
    const skeletonTints = [
      "border-blue-200 bg-blue-50/80",
      "border-green-200 bg-green-50/80",
      "border-purple-200 bg-purple-50/80",
      "border-orange-200 bg-orange-50/80",
    ];
    return (
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-md border p-4 ${skeletonTints[i] ?? skeletonTints[0]}`}
          >
            <div className="animate-pulse">
              <div className="mb-3 h-4 w-24 rounded bg-gray-200/90" />
              <div className="mb-1 h-8 w-16 rounded bg-gray-200/90" />
              <div className="h-3 w-20 rounded bg-gray-200/90" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const statsCards = [
    {
      title: "Total KOLs",
      value: metrics.totalKOLs.toString(),
      subtitle: "All KOLs",
      icon: Users,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      title: "Active KOLs",
      value: metrics.activeKOLs.toString(),
      subtitle: "Currently active",
      icon: TrendingUp,
      iconColor: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      title: "Total Followers",
      value: formatNumber(metrics.totalFollowers),
      subtitle: "Combined reach",
      icon: Target,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      title: "Active Campaigns",
      value: metrics.activeCampaigns.toString(),
      subtitle: `${metrics.totalCampaigns} total`,
      icon: DollarSign,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className={`flex flex-col rounded-md border p-4 ${stat.bgColor} ${stat.borderColor}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">{stat.title}</h3>
              <Icon className={`h-5 w-5 ${stat.iconColor}`} />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-600">{stat.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
