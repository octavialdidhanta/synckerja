import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LeadMagnetFunnelPanel } from '../components/LeadMagnetFunnelPanel';
import {
  LeadMagnetEnrollmentContentCell,
  LeadMagnetEnrollmentOpenChatCell,
  LeadMagnetEnrollmentUserCell,
} from '../components/LeadMagnetEnrollmentCells';
import { useEnrichedCampaignPosts } from '../components/CampaignPostsPreview';
import { LeadMagnetPageShell } from '../components/LeadMagnetPageShell';
import { useLeadMagnetAnalytics, useLeadMagnetCampaign } from '../hooks/useLeadMagnetCampaigns';
import { LEAD_MAGNET_PATHS } from '../lib/leadMagnetPaths';
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
  const { t } = useTranslation();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: campaign } = useLeadMagnetCampaign(campaignId);
  const { data, isLoading } = useLeadMagnetAnalytics(campaignId);
  const { displayPosts, isEnriching } = useEnrichedCampaignPosts(
    campaign?.lead_magnet_campaign_posts ?? [],
    campaign?.lead_magnet_campaign_accounts ?? [],
  );

  return (
    <LeadMagnetPageShell>
      <div className="flex flex-col gap-3">
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={LEAD_MAGNET_PATHS.list}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              {t('leadMagnet.analytics.backToList')}
            </Link>
          </Button>
          {campaign ? (
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold">{campaign.name}</p>
              <p className="text-xs text-muted-foreground">
                {t('leadMagnet.analytics.keywordLabel', { keyword: campaign.keyword })}
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid min-h-[calc(100dvh-13rem)] min-w-0 w-full grid-cols-12 gap-2">
          <div className="col-span-12 rounded-lg border bg-background p-4 shadow-sm lg:col-span-5">
            <h2 className="mb-1 text-sm font-semibold">{t('leadMagnet.analytics.funnelTitle')}</h2>
            <LeadMagnetFunnelPanel funnel={data?.funnel ?? {}} loading={isLoading} />
          </div>

          <div className="col-span-12 flex min-h-[400px] flex-col rounded-lg border bg-background p-4 shadow-sm lg:col-span-7">
            <h2 className="mb-4 text-sm font-semibold">
              {t('leadMagnet.analytics.enrollmentsTitle', {
                count: data?.enrollments?.length ?? 0,
              })}
            </h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('leadMagnet.analytics.loading')}</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('leadMagnet.analytics.colUser')}</TableHead>
                      <TableHead>{t('leadMagnet.analytics.colContent')}</TableHead>
                      <TableHead>{t('leadMagnet.analytics.colStatus')}</TableHead>
                      <TableHead>{t('leadMagnet.analytics.colTime')}</TableHead>
                      <TableHead>{t('leadMagnet.analytics.colError')}</TableHead>
                      <TableHead className="text-right pr-4">{t('leadMagnet.analytics.colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.enrollments ?? []).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <LeadMagnetEnrollmentUserCell enrollment={e} />
                        </TableCell>
                        <TableCell>
                          <LeadMagnetEnrollmentContentCell
                            enrollment={e}
                            posts={displayPosts}
                            loading={isEnriching}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString('id-ID')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                          {e.last_error ?? '—'}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex justify-end">
                            <LeadMagnetEnrollmentOpenChatCell enrollment={e} />
                          </div>
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
