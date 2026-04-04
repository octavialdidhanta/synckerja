import React, { useEffect, useMemo, useState } from 'react';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { WhatsAppConnectForm } from '../components/connect/WhatsAppConnectForm';
import { WebhookInfoDisplay } from '../components/connect/WebhookInfoDisplay';
import { policyBaseUrl } from '@/policy/contact';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { cn } from '@/shared/lib/utils';
import { useInstagramAccounts } from '../hooks/useInstagramAccounts';
import { useWhatsAppAccounts } from '../hooks/useWhatsAppAccounts';
import { useWhatsAppConfig } from '../hooks/useWhatsAppConfig';
import { WhatsAppConnectPageSkeleton } from '../skeletons/WhatsAppConnectPageSkeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CheckCircle2, Unplug, MessageCircle, Phone, Hash, Calendar, ShieldCheck, RefreshCw, FileText, Pencil } from 'lucide-react';
import type { WhatsAppAccount } from '../types';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function MetaVerifiedBadge({ className, title, 'aria-label': ariaLabel }: { className?: string; title?: string; 'aria-label'?: string }) {
  const teeth = 16;
  const R = 12;
  const r = 8.5;
  const cx = 12;
  const cy = 12;
  const points: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const radius = i % 2 === 0 ? R : r;
    const angle = (i * 360) / (teeth * 2) - 90;
    const rad = (angle * Math.PI) / 180;
    points.push(`${(cx + radius * Math.cos(rad)).toFixed(2)},${(cy + radius * Math.sin(rad)).toFixed(2)}`);
  }
  const serratedCircle = `M ${points.join(' L ')} Z`;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" title={title} aria-label={ariaLabel}>
      <path d={serratedCircle} fill="#1877F2" />
      <path d="M7 12l3 3 6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function AccountCard({
  account,
  t,
  onEdit,
  onDisconnect,
  onRefresh,
  isSyncing,
  syncingId,
}: {
  account: WhatsAppAccount;
  t: (key: string, fallback?: string) => string;
  onEdit: (a: WhatsAppAccount) => void;
  onDisconnect: (a: WhatsAppAccount) => void;
  onRefresh: (a: WhatsAppAccount) => void;
  isSyncing: boolean;
  syncingId: string | null;
}) {
  const accountName = account.whatsapp_business_name?.trim() || account.display_phone_number?.trim() || account.phone_number_id || 'WhatsApp Account';
  const displayNumber = account.display_phone_number?.trim() || '—';
  const statusUpper = account.name_status?.trim()?.toUpperCase();
  const statusLabel = statusUpper === 'APPROVED'
    ? t('whatsappConnect.statusApproved', 'Approved')
    : statusUpper === 'DECLINED'
      ? t('whatsappConnect.statusDeclined', 'Declined')
      : (account.name_status?.trim() || t('whatsappConnect.statusPending', 'Pending'));
  const updatedAtLabel = account.updated_at ? format(new Date(account.updated_at), 'd MMM yy HH:mm') : '—';
  const thisSyncing = isSyncing && syncingId === account.id;

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-5 shadow-sm">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#25D366]/15 flex items-center justify-center shrink-0">
              <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-slate-900 truncate">{accountName}</h3>
                {statusUpper === 'APPROVED' && (
                  <MetaVerifiedBadge className="w-5 h-5 shrink-0" title={t('whatsappConnect.statusApproved', 'Approved by Meta')} aria-label={t('whatsappConnect.statusApproved', 'Approved')} />
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-green-600 text-sm font-medium mt-0.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Connected
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 min-w-0">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              {t('whatsappConnect.labelNumber', 'Number')}
            </div>
            <p className="text-sm font-medium text-slate-800 truncate">{displayNumber}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              {t('whatsappConnect.labelStatus', 'Status')}
            </div>
            <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
              {statusUpper === 'APPROVED' && (
                <MetaVerifiedBadge className="w-4 h-4 shrink-0" title={t('whatsappConnect.statusApproved', 'Approved by Meta')} aria-label={t('whatsappConnect.statusApproved', 'Approved')} />
              )}
              {statusLabel}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Hash className="w-3.5 h-3.5 shrink-0" />
              {t('whatsappConnect.labelNumberId', 'Phone Number ID')}
            </div>
            <p className="text-sm font-medium text-slate-800 truncate font-mono">{account.phone_number_id ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 min-w-0">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {t('whatsappConnect.labelUpdated', 'Updated')}
            </div>
            <p className="text-sm font-medium text-slate-800">{updatedAtLabel}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-emerald-200/60 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onEdit(account)}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => onRefresh(account)}
            disabled={thisSyncing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${thisSyncing ? 'animate-spin' : ''}`} />
            {thisSyncing ? t('whatsappConnect.syncing', 'Menyinkronkan...') : t('whatsappConnect.refreshFromMeta', 'Refresh dari Meta')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => onDisconnect(account)}
          >
            <Unplug className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}

/** `/operations/consultant/whatsapp/connect` — Seamless Page Scroll Layout (`.cursor/rules/Seamless Page Scroll Layout.mdc`). */
export function WhatsAppConnectPage() {
  const { t } = useAppTranslation();
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { isLoading: configLoading } = useWhatsAppConfig();
  const { isLoading: instagramLoading } = useInstagramAccounts();
  const { accounts, isLoading: accountsLoading, disconnect, isDisconnecting, refetch } = useWhatsAppAccounts();

  const rawPending = useMemo(() => {
    const dataPending =
      Boolean(organizationId) && (accountsLoading || configLoading || instagramLoading);
    return orgLoading || dataPending;
  }, [orgLoading, organizationId, accountsLoading, configLoading, instagramLoading]);

  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (rawPending) {
      setShowSkeleton(true);
      return;
    }
    const id = window.setTimeout(() => {
      requestAnimationFrame(() => setShowSkeleton(false));
    }, 200);
    return () => clearTimeout(id);
  }, [rawPending]);
  const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<WhatsAppAccount | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const policyPublicOrigin = policyBaseUrl();

  const handleDisconnectConfirm = async () => {
    if (disconnectTarget) {
      await disconnect(disconnectTarget.id);
      setDisconnectTarget(null);
      setEditingAccount((prev) => (prev && prev.id === disconnectTarget.id ? null : prev));
    }
  };

  const handleRefreshFromMeta = async (account: WhatsAppAccount) => {
    if (!account.phone_number_id?.trim()) {
      toast.error(t('whatsappConnect.refreshError', 'Akun ini tidak memiliki Phone Number ID.'));
      return;
    }
    setIsSyncing(true);
    setSyncingId(account.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t('whatsappConnect.refreshError', 'Sesi habis. Silakan login lagi.'));
        return;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-whatsapp-business-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone_number_id: account.phone_number_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || t('whatsappConnect.refreshError', 'Gagal menyinkronkan dari Meta.');
        toast.error(data?.hint ? `${msg} ${data.hint}` : msg);
        return;
      }
      await refetch();
      toast.success(t('whatsappConnect.refreshSuccess', 'Data diperbarui dari Meta.'));
    } catch {
      toast.error(t('whatsappConnect.refreshError', 'Gagal menyinkronkan dari Meta.'));
    } finally {
      setIsSyncing(false);
      setSyncingId(null);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3',
          showSkeleton && 'pointer-events-none invisible',
        )}
        aria-hidden={showSkeleton}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex min-h-0 flex-1 flex-col gap-6">
                    <AlertDialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect WhatsApp?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Akun ini akan diputus. Percakapan tetap tersimpan. Anda bisa menambah akun lagi kapan saja.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
                          <Button variant="destructive" onClick={handleDisconnectConfirm} disabled={isDisconnecting}>
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                      <Card className="flex h-full min-h-0 flex-col">
                        <CardHeader className="shrink-0 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-[#25D366]/10 flex items-center justify-center shrink-0">
                              <svg className="w-8 h-8 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-[#25D366]">WhatsApp</h2>
                              <p className="text-sm text-gray-500">Alternative account connection</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col space-y-6 overflow-y-auto">
                          <WhatsAppConnectForm
                            editingAccount={editingAccount}
                            onClearEdit={() => setEditingAccount(null)}
                            onAfterSave={handleRefreshFromMeta}
                          />
                          <div className="border-t border-slate-200 pt-6">
                            <WebhookInfoDisplay embedded />
                          </div>
                          <div className="border-t border-slate-200 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                              <FileText className="w-4 h-4 text-slate-600 shrink-0" aria-hidden />
                              <div>
                                <h3 className="text-sm font-semibold text-slate-800">Policy URLs</h3>
                                <p className="text-xs text-slate-500">Required for Meta WhatsApp configuration</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                                <Label className="text-slate-700 text-xs font-medium uppercase tracking-wide">Privacy Policy URL</Label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <a href={`${policyPublicOrigin}/policy/privacy`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all flex-1 min-w-0">
                                    {policyPublicOrigin}/policy/privacy
                                  </a>
                                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => navigator.clipboard.writeText(`${policyPublicOrigin}/policy/privacy`)}>
                                    Copy
                                  </Button>
                                </div>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                                <Label className="text-slate-700 text-xs font-medium uppercase tracking-wide">Terms of Service URL</Label>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <a href={`${policyPublicOrigin}/policy/terms`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all flex-1 min-w-0">
                                    {policyPublicOrigin}/policy/terms
                                  </a>
                                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => navigator.clipboard.writeText(`${policyPublicOrigin}/policy/terms`)}>
                                    Copy
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="flex h-full min-h-0 flex-col">
                        <CardHeader className="shrink-0">
                          <CardTitle>{t('whatsappConnect.sectionConnectedAccounts', 'Akun yang terhubung')}</CardTitle>
                          <CardDescription>{t('whatsappConnect.sectionConnectedAccountsDescription', 'Daftar akun WhatsApp yang sudah terhubung dengan nama lengkap')}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col">
                          {accounts.length === 0 ? (
                            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                              <MessageCircle className="mb-3 h-12 w-12 text-slate-300" />
                              <p className="text-sm text-slate-600">
                                {t(
                                  'whatsappConnect.noConnectedAccounts',
                                  'Belum ada akun terhubung. Selesaikan konfigurasi di sebelah kiri untuk menghubungkan akun.',
                                )}
                              </p>
                            </div>
                          ) : (
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                              {accounts.map((account) => (
                                <AccountCard
                                  key={account.id}
                                  account={account}
                                  t={t}
                                  onEdit={setEditingAccount}
                                  onDisconnect={setDisconnectTarget}
                                  onRefresh={handleRefreshFromMeta}
                                  isSyncing={isSyncing}
                                  syncingId={syncingId}
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>

      {showSkeleton ? (
        <div
          className="absolute inset-0 z-10 min-h-0 overflow-hidden"
          aria-busy
          aria-label={t('pageAccess.loading', 'Loading…')}
        >
          <WhatsAppConnectPageSkeleton />
          <span className="sr-only">{t('pageAccess.loading', 'Loading…')}</span>
        </div>
      ) : null}
    </div>
  );
}
