import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";

interface PayrollPeriod {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export function PayrollPeriodsOverview() {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;

  const { data: periods, isLoading } = useQuery({
    queryKey: ["payroll-periods-overview", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as PayrollPeriod[];
    },
    enabled: !!organizationId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "approved":
        return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
      case "closed":
        return "bg-muted text-foreground";
      case "pending":
      case "draft":
        return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
      default:
        return "bg-muted text-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-muted h-16 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {periods?.map((period) => (
        <Card key={period.id} className="p-3 transition-shadow hover:shadow-sm">
          <CardContent className="p-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="text-primary h-4 w-4" />
                <span className="text-foreground text-sm font-medium">{period.period_name}</span>
              </div>
              <Badge className={getStatusColor(period.status)} variant="secondary">
                {period.status}
              </Badge>
            </div>
            <div className="text-muted-foreground flex items-center space-x-2 text-xs">
              <Clock className="h-3 w-3" />
              <span>
                {new Date(period.start_date).toLocaleDateString()} -{" "}
                {new Date(period.end_date).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}

      {(!periods || periods.length === 0) && (
        <div className="text-muted-foreground py-6 text-center">
          <Calendar className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No payroll periods found</p>
        </div>
      )}
    </div>
  );
}
