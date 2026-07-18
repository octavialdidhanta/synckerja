import { Link, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Plus, BarChart3, Pause, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CampaignLeadMagnetCell } from '../components/CampaignLeadMagnetCell';
import { CampaignLeadMagnetSheet } from '../components/CampaignLeadMagnetSheet';
import { CampaignMetricCell } from '../components/CampaignMetricCell';
import { CampaignPostsPreview } from '../components/CampaignPostsPreview';
import { LeadMagnetListMetricCards } from '../components/LeadMagnetListMetricCards';
import { LeadMagnetPageShell } from '../components/LeadMagnetPageShell';
import { LeadMagnetTableFooter } from '../components/LeadMagnetTableFooter';
import {
  useDeleteLeadMagnetCampaign,
  useLeadMagnetCampaigns,
  usePauseLeadMagnetCampaign,
} from '../hooks/useLeadMagnetCampaigns';
import { useLeadMagnetListDateRange } from '../hooks/useLeadMagnetListDateRange';
import { LEAD_MAGNET_PATHS } from '../lib/leadMagnetPaths';
import { LEAD_MAGNET_MAIN_GRID, LEAD_MAGNET_TABLE_SECTION } from '../lib/leadMagnetLayout';
import { TikTokAdsDateRangePicker } from '@/6-0-tiktok-ads/components/TikTokAdsDateRangePicker';
import { buildTikTokAdsCalendarYearPresetYears } from '@/tiktok-ads/lib/clampTikTokAdsDateRange';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import {
  getCampaignAccounts,
  formatCampaignPlatformsLabel,
  type LeadMagnetCampaign,
} from '../types/leadMagnet.types';

function statusVariant(status: string) {
  if (status === 'active') return 'default';
  if (status === 'paused') return 'secondary';
  if (status === 'draft') return 'outline';
  return 'secondary';
}

export function LeadMagnetListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { selection, setSelection, dateStart, dateEnd } = useLeadMagnetListDateRange(organizationId);

  const { data, isLoading } = useLeadMagnetCampaigns(!orgLoading, { dateStart, dateEnd });
  const campaigns = data?.campaigns ?? [];
  const totals = data?.totals ?? { new_followers: 0, new_emails: 0, new_phones: 0 };
  const pauseMut = usePauseLeadMagnetCampaign();
  const deleteMut = useDeleteLeadMagnetCampaign();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [pauseTarget, setPauseTarget] = useState<{ id: string; name: string } | null>(null);
  const [previewCampaign, setPreviewCampaign] = useState<LeadMagnetCampaign | null>(null);

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === 'active').length,
    [campaigns],
  );

  const metricCards = useMemo(
    () => [
      { key: 'new_followers' as const, label: t('leadMagnet.list.cardNewFollowers') },
      { key: 'new_emails' as const, label: t('leadMagnet.list.cardNewEmails') },
      { key: 'new_phones' as const, label: t('leadMagnet.list.cardNewPhones') },
    ],
    [t],
  );

  const handleConfirmPause = async () => {
    if (!pauseTarget) return;
    try {
      await pauseMut.mutateAsync(pauseTarget.id);
      toast.success(t('leadMagnet.list.pauseSuccess'));
      setPauseTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('leadMagnet.list.pauseFailed'));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success(t('leadMagnet.list.deleteSuccess'));
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('leadMagnet.list.deleteFailed'));
    }
  };

  return (
    <LeadMagnetPageShell>
      <div className={LEAD_MAGNET_MAIN_GRID}>
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Buat campaign dengan keyword di komentar IG/FB → auto DM follow gate → kirim link framework.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <TikTokAdsDateRangePicker
                value={selection}
                onChange={setSelection}
                calendarYearPresetYears={buildTikTokAdsCalendarYearPresetYears()}
                calendarYearFilterHint={t('leadMagnet.list.dateFilterHint')}
                className="h-8"
              />
              <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => navigate(LEAD_MAGNET_PATHS.new)}>
                <Plus className="h-3.5 w-3.5" />
                Campaign baru
              </Button>
            </div>
          </div>

          <LeadMagnetListMetricCards totals={totals} cards={metricCards} loading={isLoading} />

          <div className={LEAD_MAGNET_TABLE_SECTION}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Memuat…</div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
                  <p>Belum ada campaign. Mulai dengan wizard setup keyword & pesan DM.</p>
                  <Button variant="outline" size="sm" onClick={() => navigate(LEAD_MAGNET_PATHS.new)}>
                    Buat campaign pertama
                  </Button>
                </div>
              ) : (
                <>
                  <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <table className="w-full caption-bottom text-sm">
                        <TableHeader className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="min-w-[200px] bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 align-top">
                              Konten
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                              Campaign
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                              Platform
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                              Keyword
                            </TableHead>
                            <TableHead className="min-w-[140px] bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                              {t('leadMagnet.list.columnLeadMagnet')}
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                              Status
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-700">
                              {t('leadMagnet.list.columnNewFollowers')}
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-700">
                              {t('leadMagnet.list.columnNewEmails')}
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-700">
                              {t('leadMagnet.list.columnNewPhones')}
                            </TableHead>
                            <TableHead className="bg-gray-50 px-3 py-2 text-right text-xs font-medium text-gray-700">
                              Aksi
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campaigns.map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="px-3 py-2 align-top">
                                <CampaignPostsPreview
                                  posts={c.lead_magnet_campaign_posts ?? []}
                                  accounts={getCampaignAccounts(c)}
                                />
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle font-medium">{c.name}</TableCell>
                              <TableCell className="px-3 py-2 align-middle text-muted-foreground">
                                {formatCampaignPlatformsLabel(getCampaignAccounts(c))}
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle">{c.keyword}</TableCell>
                              <TableCell className="px-3 py-2 align-middle">
                                <CampaignLeadMagnetCell
                                  campaign={c}
                                  onOpen={() => setPreviewCampaign(c)}
                                />
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle">
                                <Badge variant={statusVariant(c.status)} className="text-[11px]">
                                  {c.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle text-right">
                                <CampaignMetricCell
                                  value={c.metrics?.new_followers ?? 0}
                                  tooltipKey="leadMagnet.list.newFollowersTooltip"
                                />
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle text-right">
                                <CampaignMetricCell
                                  value={c.metrics?.new_emails ?? 0}
                                  tooltipKey="leadMagnet.list.newEmailsTooltip"
                                />
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle text-right">
                                <CampaignMetricCell
                                  value={c.metrics?.new_phones ?? 0}
                                  tooltipKey="leadMagnet.list.newPhonesTooltip"
                                />
                              </TableCell>
                              <TableCell className="px-3 py-2 align-middle text-right">
                                <div className="flex justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                    <Link to={LEAD_MAGNET_PATHS.analytics(c.id)}>
                                      <BarChart3 className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" asChild>
                                    <Link to={LEAD_MAGNET_PATHS.edit(c.id)}>Edit</Link>
                                  </Button>
                                  {c.status === 'active' ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setPauseTarget({ id: c.id, name: c.name })}
                                    >
                                      <Pause className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </table>
                  </div>
                  <LeadMagnetTableFooter
                    totalCampaigns={campaigns.length}
                    activeCampaigns={activeCampaigns}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <CampaignLeadMagnetSheet
        campaign={previewCampaign}
        open={previewCampaign != null}
        onOpenChange={(open) => {
          if (!open) setPreviewCampaign(null);
        }}
      />

      <AlertDialog open={pauseTarget != null} onOpenChange={(open) => !open && setPauseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leadMagnet.list.pauseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leadMagnet.list.pauseDescription', { name: pauseTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pauseMut.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={pauseMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmPause();
              }}
            >
              {pauseMut.isPending ? t('leadMagnet.list.pausing') : t('leadMagnet.list.pauseConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('leadMagnet.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('leadMagnet.list.deleteDescription', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleteMut.isPending ? t('leadMagnet.list.deleting') : t('leadMagnet.list.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LeadMagnetPageShell>
  );
}
