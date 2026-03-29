import React from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandManagementMetricsCardsProps {
  reprimands: unknown[];
  employees: unknown[];
}

function ReprimandManagementMetricsCards({ reprimands }: ReprimandManagementMetricsCardsProps) {
  const { t } = useAppTranslation();
  const list = reprimands as Array<{ status?: string; severity_level?: string }>;

  const totalReprimands = list.length;
  const activeReprimands = list.filter((r) => r.status === "active").length;
  const resolvedReprimands = list.filter((r) => r.status === "resolved").length;
  const criticalSeverity = list.filter(
    (r) => r.severity_level === "critical" || r.severity_level === "high",
  ).length;

  const statsCards = [
    {
      title: t("reprimands.metrics.totalTitle", "Total Reprimands"),
      value: totalReprimands.toString(),
      subtitle: t("reprimands.metrics.totalSubtitle", "All records"),
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
    {
      title: t("reprimands.metrics.activeTitle", "Active Reprimands"),
      value: activeReprimands.toString(),
      subtitle: t("reprimands.metrics.activeSubtitle", "Ongoing cases"),
      icon: CheckCircle,
      iconColor: "text-brand-blue",
      bgColor: "bg-brand-blue/10",
      borderColor: "border-brand-blue/30",
    },
    {
      title: t("reprimands.metrics.resolvedTitle", "Resolved"),
      value: resolvedReprimands.toString(),
      subtitle: t("reprimands.metrics.resolvedSubtitle", "Closed cases"),
      icon: CheckCircle,
      iconColor: "text-brand-blue",
      bgColor: "bg-brand-blue/10",
      borderColor: "border-brand-blue/30",
    },
    {
      title: t("reprimands.metrics.criticalTitle", "Critical / High"),
      value: criticalSeverity.toString(),
      subtitle: t("reprimands.metrics.criticalSubtitle", "High priority"),
      icon: XCircle,
      iconColor: "text-red-500",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} rounded-md border p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">{stat.title}</h3>
            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ReprimandManagementMetricsCards;
