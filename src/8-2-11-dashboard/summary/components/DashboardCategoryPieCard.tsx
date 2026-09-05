import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type DashboardCategorySlice = {
  name: string;
  value: number;
};

type Props = {
  title: string;
  slices: DashboardCategorySlice[];
};

const COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#84CC16"];
const PAGE_SIZE = 8;

export function DashboardCategoryPieCard({ title, slices }: Props) {
  const { t } = useAppTranslation();
  const [page, setPage] = useState(0);
  const visibleSlices = slices.filter((slice) => slice.value > 0);
  const pageCount = Math.max(1, Math.ceil(visibleSlices.length / PAGE_SIZE));
  const legend = visibleSlices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  return (
    <section className="min-h-[320px] rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {visibleSlices.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          {t("operationsDashboard.charts.empty", "No sales data for this period.")}
        </div>
      ) : (
        <div className="grid items-center gap-2 sm:grid-cols-2">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={visibleSlices} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                {visibleSlices.map((slice, index) => (
                  <Cell key={slice.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div>
            <ul className="space-y-2" aria-label={`${title} legend`}>
              {legend.map((slice) => {
                const index = visibleSlices.indexOf(slice);
                return (
                  <li key={slice.name} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="truncate">{slice.name}</span>
                    </span>
                    <span className="tabular-nums">{slice.value.toLocaleString("id-ID")}</span>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 ? (
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
                  {t("operationsDashboard.pagination.previous", "Previous")}
                </Button>
                <span className="text-xs text-muted-foreground">{page + 1}/{pageCount}</span>
                <Button type="button" size="sm" variant="outline" disabled={page + 1 === pageCount} onClick={() => setPage((value) => value + 1)}>
                  {t("operationsDashboard.pagination.next", "Next")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
