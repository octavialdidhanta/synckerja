import { Target, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { useKOLCampaigns } from "../hooks/useKOLCampaigns";

const formatCurrency = (amount: number) => {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(1)}K`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
};

export const KOLCampaignsMetricsCards = () => {
  const { campaigns, isLoading } = useKOLCampaigns();

  if (isLoading) {
    const skeletonTints = [
      "border-brand-blue/25 bg-brand-blue-soft/80",
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

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const totalBudget = campaigns.reduce((sum, c: any) => sum + (c.total_budget || 0), 0);
  const remainingBudget = campaigns.reduce(
    (sum, c: any) => sum + ((c.total_budget || 0) - (c.allocated_budget || 0)),
    0,
  );

  const statsCards = [
    {
      title: "Total Campaigns",
      value: totalCampaigns.toString(),
      subtitle: "All campaigns",
      icon: Target,
      iconColor: "text-brand-blue",
      bgColor: "bg-brand-blue-soft",
      borderColor: "border-brand-blue/25",
    },
    {
      title: "Active Campaigns",
      value: activeCampaigns.toString(),
      subtitle: "Currently running",
      icon: TrendingUp,
      iconColor: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      title: "Total Budget",
      value: formatCurrency(totalBudget),
      subtitle: "All campaigns budget",
      icon: DollarSign,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      title: "Remaining Budget",
      value: formatCurrency(remainingBudget),
      subtitle: "Available for assignment",
      icon: BarChart3,
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
            className={`${stat.bgColor} ${stat.borderColor} flex flex-col rounded-md border p-4`}
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

