import { CheckCircle2, Flame, Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useHabitTracker } from "../context/HabitTrackerContext";

export const HabitStats = () => {
  const { stats, habits } = useHabitTracker();
  const totalHabits = habits.length;
  const activeHabits = habits.filter((h) => h.is_active).length;
  const totalCompletionRate =
    stats.length > 0
      ? stats.reduce((sum, s) => sum + (Number.isFinite(s.completion_rate) ? s.completion_rate : 0), 0) / stats.length
      : 0;
  const totalStreak = stats.reduce((sum, s) => sum + s.current_streak, 0);
  const statCards = [
    { label: "Total Habits", value: totalHabits, icon: Target, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Active Habits", value: activeHabits, icon: CheckCircle2, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Avg Completion", value: `${totalCompletionRate.toFixed(0)}%`, icon: TrendingUp, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "Total Streak", value: totalStreak, icon: Flame, color: "text-primary", bgColor: "bg-primary/10" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border border-primary/20 bg-white ring-1 ring-primary/10">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-1 text-xs text-gray-600">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} rounded-lg p-2`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
