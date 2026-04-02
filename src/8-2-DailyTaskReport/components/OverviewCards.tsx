import React from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useDailyTaskReport } from "../context/ReportContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { applyVariables } from "@/shared/i18n/translations";

export const OverviewCards = () => {
  const { t } = useAppTranslation();
  const { filtered } = useDailyTaskReport();
  const total = filtered.length;
  const completed = filtered.filter((p) => p.isCompleted).length;
  const withDue = filtered.filter((p) => p.dueDate).length;
  const ontime = filtered.filter((p) => p.isOnTime === true).length;
  const late = filtered.filter((p) => p.isOnTime === false).length;
  const pending = total - completed;

  const efficiencyRate = completed > 0 ? Math.round((ontime / completed) * 100 * 10) / 10 : 0;

  const now = new Date();
  const eligibleTasks = filtered.filter((p) => {
    if (p.isCompleted) return true;
    if (!p.isCompleted && p.dueDate) {
      const dueDate = new Date(p.dueDate);
      dueDate.setHours(23, 59, 59, 999);
      return now.getTime() > dueDate.getTime();
    }
    return false;
  });

  const eligibleTotal = eligibleTasks.length;
  const eligibleOnTime = eligibleTasks.filter((p) => p.isOnTime === true).length;
  const eligibleLate = eligibleTasks.filter((p) => p.isOnTime === false).length;
  const eligibleOverdue = eligibleTasks.filter((p) => {
    if (p.isCompleted || !p.dueDate) return false;
    const dueDate = new Date(p.dueDate);
    dueDate.setHours(23, 59, 59, 999);
    return now.getTime() > dueDate.getTime();
  }).length;

  const weightedScore =
    eligibleTotal > 0
      ? Math.round(
          (((eligibleOnTime * 1.0) + (eligibleLate * 0.5) + (eligibleOverdue * 0)) / eligibleTotal) *
            100 *
            10,
        ) / 10
      : 0;

  const getColorForPercentage = (value: number) => {
    if (value >= 80) return "border-brand-blue/30 bg-gradient-to-br from-brand-blue/10 to-brand-blue/5";
    if (value >= 60) return "border-brand-blue/25 bg-gradient-to-br from-brand-blue/10 to-white";
    if (value >= 40) return "border-brand-blue/20 bg-gradient-to-br from-brand-blue/5 to-white";
    return "border-brand-blue/15 bg-gradient-to-br from-brand-blue/[0.03] to-white";
  };

  const Card = ({
    title,
    value,
    color,
    icon,
    description,
    formula,
    trend,
  }: {
    title: string;
    value: number | string;
    color: string;
    icon?: React.ReactNode;
    description?: string;
    formula?: string;
    trend?: { value: number; label: string };
  }) => {
    const TrendIcon = trend ? (trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus) : null;
    const trendColor = trend ? (trend.value > 0 ? "text-green-600" : trend.value < 0 ? "text-red-600" : "text-gray-400") : "";

    return (
      <div className={`w-full rounded-lg border bg-white p-3 ${color}`.trim()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold text-brand-blue">{value}</div>
            {trend && TrendIcon && (
              <div className={`flex items-center gap-0.5 text-xs ${trendColor}`} title={trend.label}>
                <TrendIcon className="w-3 h-3" />
                <span>{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          {description && <div className="text-xs text-gray-500">{description}</div>}
          {formula && (
            <div className="text-[10px] text-gray-500 mt-1 font-mono leading-tight" title={formula}>
              {formula}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full mb-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <Card title={t("dailyTaskReport.overview.totalAssignments", "Total Assignments")} value={total} color="border-brand-blue/20 bg-gradient-to-br from-brand-blue/[0.06] to-white" />
        <Card
          title={t("dailyTaskReport.overview.completed", "Completed")}
          value={completed}
          color="border-brand-blue/20 bg-gradient-to-br from-brand-blue/10 to-brand-blue/[0.04]"
        />
        <Card
          title={t("dailyTaskReport.overview.onTime", "On Time")}
          value={ontime}
          color="border-green-100 bg-gradient-to-br from-green-50 to-emerald-50"
        />
        <Card
          title={t("dailyTaskReport.overview.late", "Late")}
          value={late}
          color="border-red-100 bg-gradient-to-br from-red-50 to-orange-50"
        />
        <Card
          title={t("dailyTaskReport.overview.efficiencyRateTitle", "Efficiency Rate")}
          value={`${efficiencyRate}%`}
          color={getColorForPercentage(efficiencyRate)}
          description={applyVariables(t("dailyTaskReport.overview.efficiencyRate.description", "{{ontime}}/{{completed}} on time"), {
            ontime: String(ontime),
            completed: String(completed),
          })}
          formula={t("dailyTaskReport.overview.efficiencyRate.formula", "On Time ÷ Completed")}
        />
        <Card
          title={t("dailyTaskReport.overview.productivityScoreTitle", "Productivity Score")}
          value={`${weightedScore}%`}
          color={getColorForPercentage(weightedScore)}
          description={applyVariables(
            t("dailyTaskReport.overview.productivityScore.description", "Only count: Completed + Overdue ({{count}} tasks)"),
            { count: String(eligibleTotal) },
          )}
          formula={applyVariables(t("dailyTaskReport.overview.productivityScore.formula", "(On Time × 1.0 + Late × 0.5) ÷ {{count}}"), {
            count: String(eligibleTotal),
          })}
        />
      </div>
    </div>
  );
};

