import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useWhatsAppTemplateFollowups } from '../hooks/useWhatsAppTemplateFollowups';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { cn } from '@/shared/lib/utils';

export function WhatsAppTemplateFollowupsPage() {
  const { t, dateFnsLocale } = useAppTranslation();
  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { data: rows = [], isPending, error } = useWhatsAppTemplateFollowups(organizationId);
  const rawPagePending = orgBootstrapPending || (Boolean(organizationId) && isPending);
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    rawPagePending,
    '/omnichannel/livechat/template-follow-ups',
  );
  const showContent = useDebouncedReady(!showFullPageSkeleton, 220);

  const formatDt = (iso: string) => {
    try {
      return format(parseISO(iso), 'dd MMM yyyy, HH:mm', { locale: dateFnsLocale });
    } catch {
      return iso;
    }
  };

  return (
    <div className="relative flex h-screen flex-col bg-gray-100">
      <HeaderAndTab />
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col px-4 pb-4',
          !showContent && 'pointer-events-none invisible select-none',
        )}
        aria-hidden={!showContent}
      >
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ModuleShellContentGate pagePath="/omnichannel/livechat/template-follow-ups">
          <div className="min-h-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">
              {t('whatsappTemplateFollowups.pageTitle', 'Log follow-up template')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('whatsappTemplateFollowups.pageIntro', 'Riwayat pengiriman template follow-up dari livechat.')}
            </p>

            {orgBootstrapPending || isPending ? (
              <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span className="sr-only">Loading</span>
              </div>
            ) : error ? (
              <p className="mt-6 text-sm text-destructive">{String((error as Error).message)}</p>
            ) : rows.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                {t('whatsappTemplateFollowups.empty', 'Belum ada follow-up template.')}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('whatsappTemplateFollowups.col.time', 'Waktu')}</TableHead>
                      <TableHead>{t('whatsappTemplateFollowups.col.ticket', 'Ticket')}</TableHead>
                      <TableHead>{t('whatsappTemplateFollowups.col.customer', 'Customer')}</TableHead>
                      <TableHead>{t('whatsappTemplateFollowups.col.template', 'Template')}</TableHead>
                      <TableHead>{t('whatsappTemplateFollowups.col.agent', 'Agen')}</TableHead>
                      <TableHead>{t('whatsappTemplateFollowups.col.status', 'Status')}</TableHead>
                      <TableHead className="text-right">{t('whatsappTemplateFollowups.col.action', 'Aksi')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDt(row.created_at)}</TableCell>
                        <TableCell className="font-mono text-sm">{row.ticket_id ?? '—'}</TableCell>
                        <TableCell className="text-sm">{row.customer_wa_id}</TableCell>
                        <TableCell className="text-sm">
                          {row.template_name}
                          <span className="text-muted-foreground"> · {row.template_language}</span>
                        </TableCell>
                        <TableCell className="text-sm">{row.sender_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {row.send_status === 'sent'
                            ? t('whatsappTemplateFollowups.status.sent', 'Terkirim')
                            : t('whatsappTemplateFollowups.status.failed', 'Gagal')}
                          {row.error_message ? (
                            <span
                              className="mt-0.5 block max-w-[12rem] truncate text-xs text-destructive"
                              title={row.error_message}
                            >
                              {row.error_message}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/omnichannel/livechat?conversation=${row.whatsapp_conversation_id}`}>
                              {t('whatsappTemplateFollowups.openChat', 'Buka chat')}
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          </ModuleShellContentGate>
        </div>
      </div>
    </div>
  );
}