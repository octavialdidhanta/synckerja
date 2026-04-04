import { FileText, CheckCircle2, Target, Coins } from "lucide-react";
import type { ContentPostRecord } from "@/shared/types/content-post";

const formatCurrency = (amount: number) => {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(1)}K`;
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
};

export const ContentPostMetricsCards = ({
  posts,
  totalMilestoneAmount,
}: {
  posts: ContentPostRecord[];
  totalMilestoneAmount: number;
}) => {
  const totalPosts = posts.length;
  const postedPosts = posts.filter((post) => post.status === "posted").length;
  const draftPosts = posts.filter((post) => post.status === "draft").length;

  const statsCards = [
    {
      title: "Total Posts",
      value: totalPosts.toString(),
      subtitle: "All content posts",
      icon: FileText,
      iconColor: "text-brand-blue",
      bgColor: "bg-brand-blue-soft",
      borderColor: "border-brand-blue/25",
    },
    {
      title: "Posted",
      value: postedPosts.toString(),
      subtitle: "Published",
      icon: CheckCircle2,
      iconColor: "text-green-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      title: "Draft",
      value: draftPosts.toString(),
      subtitle: "Not published yet",
      icon: Target,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      title: "Nominal Milestone",
      value: formatCurrency(totalMilestoneAmount),
      subtitle: "Sum of milestone amounts",
      icon: Coins,
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
