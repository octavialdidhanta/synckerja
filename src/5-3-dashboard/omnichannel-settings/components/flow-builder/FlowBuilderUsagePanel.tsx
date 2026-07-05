import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

type UsageRow = {
  flowId: string;
  flowName: string;
  active: number;
  paused: number;
  completed: number;
  sampleConversationId: string | null;
};

export function FlowBuilderUsagePanel() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();

  const { data = [], isPending, isError } = useQuery({
    queryKey: ["automation-flow-usage", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<UsageRow[]> => {
      const { data: flows, error: flowErr } = await supabase
        .from("omnichannel_automation_flows")
        .select("id, name")
        .eq("organization_id", organizationId!);
      if (flowErr) throw flowErr;

      const { data: enrollments, error: enrollErr } = await supabase
        .from("omnichannel_flow_enrollments")
        .select("flow_id, status, conversation_id")
        .eq("organization_id", organizationId!);
      if (enrollErr) throw enrollErr;

      return (flows ?? []).map((flow) => {
        const rows = (enrollments ?? []).filter((e) => e.flow_id === flow.id);
        const sample = rows.find((r) => r.conversation_id)?.conversation_id ?? null;
        return {
          flowId: flow.id,
          flowName: flow.name,
          active: rows.filter((r) => r.status === "active" || r.status === "waiting_for_reply").length,
          paused: rows.filter((r) => r.status === "paused").length,
          completed: rows.filter((r) => r.status === "completed").length,
          sampleConversationId: sample,
        };
      });
    },
  });

  const hasRows = useMemo(() => data.some((r) => r.active + r.paused + r.completed > 0), [data]);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return <div className="text-sm text-destructive">{t("omnichannel.settings.flowBuilder.listing.loadFailed")}</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t("omnichannel.automationFlow.usage.title")}</h3>
      {!hasRows ? (
        <p className="text-sm text-muted-foreground">{t("omnichannel.automationFlow.usage.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("omnichannel.automationFlow.usage.colFlow")}</TableHead>
                <TableHead>{t("omnichannel.automationFlow.usage.colActive")}</TableHead>
                <TableHead>{t("omnichannel.automationFlow.usage.colPaused")}</TableHead>
                <TableHead>{t("omnichannel.automationFlow.usage.colCompleted")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.flowId}>
                  <TableCell className="font-medium">{row.flowName}</TableCell>
                  <TableCell>{row.active}</TableCell>
                  <TableCell>{row.paused}</TableCell>
                  <TableCell>{row.completed}</TableCell>
                  <TableCell>
                    {row.sampleConversationId ? (
                      <Link
                        className="text-sm text-primary hover:underline"
                        to={`/omnichannel/livechat?conversation=${encodeURIComponent(row.sampleConversationId)}`}
                      >
                        {t("omnichannel.automationFlow.usage.viewConversation")}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
