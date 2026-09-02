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
import { LeadMagnetWorkspace } from '../layout/LeadMagnetWorkspace';
import { useLeadMagnetAnalytics, useLeadMagnetCampaign } from '../hooks/useLeadMagnetCampaigns';
import { LEAD_MAGNET_PATHS } from '../lib/leadMagnetPaths';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
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
  const enrollments = data?.enrollments ?? [];

  return (
    <LeadMagnetPageShell>
      <LeadMagnetWorkspace
        count={enrollments.length}
        sectionLabel={t('leadMagnet.analytics.enrollmentsSection', 'Enrollments')}
        toolbar={
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
        }
        sidebar={
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
            <h2 className="mb-1 flex-shrink-0 text-sm font-semibold">{t('leadMagnet.analytics.funnelTitle')}</h2>
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LeadMagnetFunnelPanel funnel={data?.funnel ?? {}} loading={isLoading} />
            </div>
          </div>
        }
      >
        <h2 className="flex-shrink-0 px-4 pt-4 text-sm font-semibold">
          {t('leadMagnet.analytics.enrollmentsTitle', { count: enrollments.length })}
        </h2>
        {isLoading ? (
          <div
            className="min-h-0 min-w-0 flex-1 space-y-2 p-3"
            aria-busy
            aria-label={t('leadMagnet.analytics.loadingAria', 'Loading campaign analytics')}
          >
            <span className="sr-only">{t('leadMagnet.analytics.loadingAria', 'Loading campaign analytics')}</span>
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                {enrollments.map((e) => (
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
      </LeadMagnetWorkspace>
    </LeadMagnetPageShell>
  );
}
