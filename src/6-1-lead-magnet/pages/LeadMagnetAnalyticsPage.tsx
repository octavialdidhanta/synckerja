import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LeadMagnetPageShell } from '../components/LeadMagnetPageShell';
import { useLeadMagnetAnalytics, useLeadMagnetCampaign } from '../hooks/useLeadMagnetCampaigns';
import { LEAD_MAGNET_FUNNEL_STEPS, LEAD_MAGNET_PATHS } from '../lib/leadMagnetPaths';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

export function LeadMagnetAnalyticsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: campaign } = useLeadMagnetCampaign(campaignId);
  const { data, isLoading } = useLeadMagnetAnalytics(campaignId);

  const chartData = LEAD_MAGNET_FUNNEL_STEPS.map((s) => ({
    step: s.label,
    count: data?.funnel?.[s.key] ?? 0,
  }));

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <LeadMagnetPageShell>
      <div className="flex flex-col gap-3">
        <div className="flex-shrink-0">
          <Button variant="ghost" size="sm" asChild>
            <Link to={LEAD_MAGNET_PATHS.list}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Daftar campaign
            </Link>
          </Button>
        </div>

        <div className="grid min-h-[calc(100dvh-13rem)] min-w-0 w-full grid-cols-12 gap-2">
              <div className="col-span-12 lg:col-span-5 rounded-lg border bg-background p-4 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold">Funnel conversion</h2>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat…</p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, maxCount]} allowDecimals={false} />
                        <YAxis type="category" dataKey="step" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="col-span-12 lg:col-span-7 flex min-h-[400px] flex-col rounded-lg border bg-background p-4 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold">Enrollments ({data?.enrollments?.length ?? 0})</h2>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat…</p>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data?.enrollments ?? []).map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>{e.participant_username ?? e.participant_scoped_id.slice(0, 10)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{e.status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                              {e.last_error ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
        </div>
      </div>
    </LeadMagnetPageShell>
  );
}
