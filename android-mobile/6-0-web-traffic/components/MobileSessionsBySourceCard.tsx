import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type SourceBreakdownRow = {
  key: string;
  label: string;
  sessions: number;
};

function displaySourceKey(key: string, label: string) {
  const k = (key ?? "").trim();
  if (k === "utm") return "UTM";
  if (k === "paid_click_ids") return "Paid";
  if (k === "referral") return "Ref";
  if (k === "direct") return "Direct";
  return (label ?? "").trim() || k || "—";
}

export function MobileSessionsBySourceCard({
  rows,
  loading,
}: {
  rows: SourceBreakdownRow[];
  loading: boolean;
}) {
  const { t } = useAppTranslation();

  const data = useMemo(() => {
    const safe = Array.isArray(rows) ? rows : [];
    return safe
      .map((r) => ({
        key: String(r.key ?? r.label ?? ""),
        label: displaySourceKey(String(r.key ?? ""), String(r.label ?? "")),
        sessions: Number(r.sessions ?? 0),
      }))
      .filter((r) => r.label && Number.isFinite(r.sessions))
      .sort((a, b) => b.sessions - a.sessions);
  }, [rows]);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-sm font-medium text-foreground">
        {t("traffic.mobile.sessionsBySource", "Sessions")}
      </div>

      {loading ? (
        <div className="mt-2 h-40 w-full rounded bg-muted/30" aria-hidden />
      ) : data.length === 0 ? (
        <div className="mt-2 text-sm text-muted-foreground">{t("common.empty", "Tidak ada data.")}</div>
      ) : (
        <div className="mt-2 h-40 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 2 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={42}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(v) => [Number(v ?? 0).toLocaleString(), t("traffic.kpi.sessions", "Sessions")]}
              />
              <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

