import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useWhatsAppTemplateFollowups } from '../hooks/useWhatsAppTemplateFollowups';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { cn } from '@/shared/lib/utils';
import { TemplateFollowupsWorkspace } from '../layout/TemplateFollowupsWorkspace';
import { WhatsAppTemplateFollowupsPageSkeleton } from '../skeletons/WhatsAppTemplateFollowupsPageSkeleton';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

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
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className={MAIN_SCROLL}>
            <div className="relative flex min-h-full min-w-0 flex-1 flex-col bg-muted/40">
              <div
                className={cn(
                  'flex min-h-full min-w-0 flex-1 flex-col',
                  !showContent && 'pointer-events-none invisible',
                )}
                aria-hidden={!showContent}
              >
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>

                <ModuleShellContentGate pagePath="/omnichannel/livechat/template-follow-ups">
                  <TemplateFollowupsWorkspace count={rows.length}>
                    {error ? (
                      <p className="flex-1 px-4 py-6 text-sm text-destructive">{String((error as Error).message)}</p>
                    ) : rows.length === 0 ? (
                      <p className="flex-1 px-4 py-6 text-sm text-muted-foreground">
                        {t('whatsappTemplateFollowups.empty', 'Belum ada follow-up template.')}
                      </p>
                    ) : (
                      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('whatsappTemplateFollowups.col.time', 'Waktu')}</TableHead>
                              <TableHead>{t('whatsappTemplateFollowups.col.ticket', 'Ticket')}</TableHead>
                              <TableHead>{t('whatsappTemplateFollowups.col.customer', 'Customer')}</TableHead>
                              <TableHead>{t('whatsappTemplateFollowups.col.template', 'Template')}</TableHead>
                              <TableHead>{t('whatsappTemplateFollowups.col.agent', 'Agen')}</TableHead>
                              <TableHead>{t('whatsappTemplateFollowups.col.status', 'Status')}</TableHead>
                              <TableHead className="text-right">
                                {t('whatsappTemplateFollowups.col.action', 'Aksi')}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="whitespace-nowrap text-sm">
                                  {formatDt(row.created_at)}
                                </TableCell>
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
                                    <Link
                                      to={`/omnichannel/livechat?conversation=${row.whatsapp_conversation_id}`}
                                    >
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
                  </TemplateFollowupsWorkspace>
                </ModuleShellContentGate>
              </div>

              {!showContent && (
                <div className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-muted/40">
                  <WhatsAppTemplateFollowupsPageSkeleton mode="overlay" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
