import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useEmailConnections } from '../hooks/useEmailConnections';
import { EmailConnectPageSkeleton } from './EmailConnectPageSkeleton';
import { Mail, Plus, ChevronLeft, ChevronDown, CheckCircle2, Unplug, MessageCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import type { EmailConnection } from '../types';
import { EmailConnectionVerifyPanel } from '../components/connect/EmailConnectionVerifyPanel';

const EMAIL_INBOUND_DOMAIN = (import.meta.env.VITE_EMAIL_INBOUND_DOMAIN as string)?.trim() || 'chat.example.com';

/** Deterministic inbound address per (org, email) so re-adding the same connection gives the same address. */
async function generateInboundAddress(organizationId: string, emailAddress: string): Promise<string> {
  const input = `${organizationId}|${emailAddress.toLowerCase().trim()}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const id = hex.slice(0, 12);
  return `inbound-${id}@${EMAIL_INBOUND_DOMAIN}`;
}

/** Email providers — Hostinger IMAP first (direct connect, no forwarder). */
const EMAIL_PROVIDERS = [
  'Hostinger (IMAP)',
  'Gmail (IMAP)',
  'Outlook (IMAP)',
  'Yahoo (IMAP)',
] as const;

/** `/omnichannel/integrations/email` — Seamless Page Scroll Layout (`.cursor/rules/Seamless Page Scroll Layout.mdc`). */
export function EmailConnectPage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { connections, isLoading: connectionsLoading, connectImap, connectImapMutation, syncImap, syncImapMutation, deleteConnection } =
    useEmailConnections();

  const hasPendingLoad = orgLoading || (!!organizationId && connectionsLoading);
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    hasPendingLoad,
    '/omnichannel/integrations/email',
  );
  const [showSkeleton, setShowSkeleton] = useState(showFullPageSkeleton);

  useEffect(() => {
    if (showFullPageSkeleton) {
      setShowSkeleton(true);
      return;
    }
    let raf = 0;
    const delayMs = 200;
    const hideTimer = window.setTimeout(() => {
      raf = requestAnimationFrame(() => setShowSkeleton(false));
    }, delayMs);
    return () => {
      window.clearTimeout(hideTimer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [showFullPageSkeleton]);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [providerOpen, setProviderOpen] = useState(false);
  const [customProvider, setCustomProvider] = useState(false);
  const [customImapHost, setCustomImapHost] = useState('');
  const [customSmtpHost, setCustomSmtpHost] = useState('');
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  const handleBack = () => {
    setIsAddingEmail(false);
    setConnectedEmail(null);
    setEmail('');
    setPassword('');
    setProvider('');
    setCustomImapHost('');
    setCustomSmtpHost('');
  };
  const handleSelectProvider = (value: string) => {
    setProvider(value);
    setProviderOpen(false);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrim = email.trim();
    if (!emailTrim) {
      toast.error(t('emailConnect.emailRequired', 'Email address is required.'));
      return;
    }
    if (!password.trim()) {
      toast.error(t('emailConnect.passwordRequired', 'Password akun email wajib diisi.'));
      return;
    }
    if (!provider.trim()) {
      toast.error(t('emailConnect.providerRequired', 'Pilih provider email.'));
      return;
    }
    if (!organizationId) {
      toast.error(t('emailConnect.noOrganization', 'No organization selected.'));
      return;
    }
    const alreadyConnected = connections.some(
      (c) => c.email_address?.toLowerCase().trim() === emailTrim.toLowerCase()
    );
    if (alreadyConnected) {
      toast.error(t('emailConnect.alreadyConnected', 'This email is already connected.'));
      return;
    }
    try {
      const inboundAddress = await generateInboundAddress(organizationId, emailTrim);
      const passwordForConnect =
        provider.includes('Gmail') ? password.replace(/\s+/g, '') : password.trim();
      await connectImap({
        email_address: emailTrim,
        password: passwordForConnect,
        inbound_address: inboundAddress,
        provider: provider || 'Hostinger (IMAP)',
        imap_host: customProvider ? customImapHost.trim() || null : null,
        smtp_host: customProvider ? customSmtpHost.trim() || null : null,
      });
      setConnectedEmail(emailTrim);
      toast.success(
        t(
          'emailConnect.connectionCreatedImap',
          'Email terhubung via IMAP. Pesan masuk akan muncul di Live Chat otomatis.',
        ),
      );
    } catch (err) {
      toast.error((err as Error)?.message ?? t('emailConnect.createFailed', 'Failed to create connection.'));
    }
  };
  const handleDoneAfterCreate = () => {
    setConnectedEmail(null);
    setIsAddingEmail(false);
    setEmail('');
    setPassword('');
    setProvider('');
  };
  const handleOpenLiveChat = () => navigate('/omnichannel/livechat');
  const handleSyncImap = async (connectionId: string) => {
    try {
      await syncImap(connectionId);
      toast.success(t('emailConnect.imapSyncStarted', 'Sinkron email dimulai.'));
    } catch (err) {
      toast.error((err as Error)?.message ?? t('emailConnect.imapSyncFailed', 'Sinkron gagal.'));
    }
  };
  const handleRemoveConnection = async (conn: EmailConnection) => {
    if (!window.confirm(t('emailConnect.confirmRemove', 'Remove this email connection?'))) return;
    try {
      await deleteConnection(conn.id);
      toast.success(t('emailConnect.removed', 'Connection removed.'));
    } catch {
      toast.error(t('emailConnect.removeFailed', 'Failed to remove connection.'));
    }
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3',
          showSkeleton && 'invisible pointer-events-none select-none',
        )}
        aria-hidden={showSkeleton}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate pagePath="/omnichannel/integrations/email">
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex min-h-0 flex-1 flex-col gap-6">
                      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[1fr_3fr] md:grid-rows-1 md:items-stretch">
                      {/* Left sidebar: Connect Email */}
                      <Card className="flex h-full min-h-0 flex-col">
                        <CardHeader className="shrink-0 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand-blue/20 to-brand-blue-soft flex items-center justify-center shrink-0">
                              <Mail className="w-8 h-8 text-brand-blue" />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-brand-blue-deep">
                                {t('emailConnect.leftTitle', 'Connect Email')}
                              </h2>
                              <p className="text-sm text-gray-500">
                                {t(
                                  'emailConnect.descriptionImap',
                                  'Hubungkan akun Hostinger langsung — tanpa forwarder atau verifikasi Resend.',
                                )}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto">
                          {!isAddingEmail ? (
                            <>
                              <Button
                                type="button"
                                className="w-full"
                                onClick={() => {
                                  setProvider('Hostinger (IMAP)');
                                  setIsAddingEmail(true);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                {t('emailConnect.addEmail', 'Add Email')}
                              </Button>
                            </>
                          ) : (
                            <div className="space-y-5">
                              {/* Breadcrumb */}
                              <div className="flex items-center gap-1 text-sm text-slate-600">
                                <button
                                  type="button"
                                  onClick={handleBack}
                                  className="flex items-center gap-1 text-brand-blue hover:text-brand-blue-deep hover:underline"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                  {t('emailConnect.back', 'Back')}
                                </button>
                                <span className="text-slate-400">/</span>
                                <span>{t('emailConnect.addEmailAccount', 'Add Email Account')}</span>
                              </div>

                              <div className="space-y-4">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="email-address">
                                      {t('emailConnect.emailAddress', 'Email Address *')}
                                    </Label>
                                    <Input
                                      id="email-address"
                                      type="email"
                                      placeholder={t('emailConnect.emailPlaceholder', 'Enter email address')}
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      className="w-full h-10 rounded-md border border-input"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="email-password">
                                      {provider.includes('Gmail')
                                        ? t('emailConnect.gmailAppPassword', 'App Password Gmail *')
                                        : t('emailConnect.password', 'Password (Encrypted) *')}
                                    </Label>
                                    <Input
                                      id="email-password"
                                      type="password"
                                      placeholder={
                                        provider.includes('Gmail')
                                          ? t('emailConnect.gmailAppPasswordPlaceholder', '16 karakter App Password')
                                          : t('emailConnect.passwordPlaceholder', 'Enter password')
                                      }
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      className="w-full h-10 rounded-md border border-input"
                                    />
                                    {provider.includes('Gmail') ? (
                                      <p className="text-xs leading-relaxed text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                                        {t(
                                          'emailConnect.gmailAppPasswordHint',
                                          'Gmail tidak menerima password login biasa untuk IMAP. Buat App Password: Google Account → Keamanan → Verifikasi 2 langkah → App Password → Mail. Aktifkan IMAP di Gmail Settings → Forwarding and POP/IMAP.',
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="space-y-2">
                                    <Label>
                                      {t('emailConnect.provider', 'Provider *')}
                                    </Label>
                                    <Popover open={providerOpen} onOpenChange={setProviderOpen}>
                                      <PopoverTrigger asChild>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          role="combobox"
                                          aria-expanded={providerOpen}
                                          className="w-full h-10 justify-between font-normal"
                                        >
                                          <span className={cn(!provider && 'text-muted-foreground')}>
                                            {provider || t('emailConnect.providerPlaceholder', 'Select provider')}
                                          </span>
                                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                        <Command>
                                          <CommandInput
                                            placeholder={t('emailConnect.searchProvider', 'Search provider...')}
                                            className="h-10"
                                          />
                                          <CommandList className="max-h-[300px]">
                                            <CommandEmpty>
                                              {t('emailConnect.noProviderFound', 'No provider found.')}
                                            </CommandEmpty>
                                            {EMAIL_PROVIDERS.map((name) => (
                                              <CommandItem
                                                key={name}
                                                value={name}
                                                onSelect={() => handleSelectProvider(name)}
                                              >
                                                {name}
                                              </CommandItem>
                                            ))}
                                          </CommandList>
                                        </Command>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id="custom-provider"
                                      checked={customProvider}
                                      onCheckedChange={(checked) => setCustomProvider(checked === true)}
                                    />
                                    <Label
                                      htmlFor="custom-provider"
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {t('emailConnect.customProvider', 'Custom Provider Manually')}
                                    </Label>
                                  </div>
                                  {customProvider ? (
                                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                                      <div className="space-y-2">
                                        <Label htmlFor="custom-imap-host">
                                          {t('emailConnect.customImapHost', 'IMAP host')}
                                        </Label>
                                        <Input
                                          id="custom-imap-host"
                                          placeholder="imap.hostinger.com"
                                          value={customImapHost}
                                          onChange={(e) => setCustomImapHost(e.target.value)}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="custom-smtp-host">
                                          {t('emailConnect.customSmtpHost', 'SMTP host')}
                                        </Label>
                                        <Input
                                          id="custom-smtp-host"
                                          placeholder="smtp.hostinger.com"
                                          value={customSmtpHost}
                                          onChange={(e) => setCustomSmtpHost(e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                  <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={connectImapMutation.isPending}
                                  >
                                    {connectImapMutation.isPending
                                      ? t('emailConnect.submitting', 'Submitting...')
                                      : t('emailConnect.submit', 'Submit')}
                                  </Button>
                                </form>
                              </div>
                            </div>
                          )}
                          {connectedEmail ? (
                            <div className="space-y-4 rounded-lg border border-green-200 bg-green-50/80 p-4">
                              <div className="flex items-center gap-2 font-semibold text-green-800">
                                <CheckCircle2 className="h-5 w-5 shrink-0" />
                                {t('emailConnect.imapConnectedTitle', 'Email terhubung')}
                              </div>
                              <p className="text-sm text-slate-700">
                                {t(
                                  'emailConnect.imapConnectedHint',
                                  '{{email}} aktif via IMAP. Pesan masuk akan disinkronkan ke Live Chat setiap ~2 menit.',
                                  { email: connectedEmail },
                                )}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="default" size="sm" onClick={handleOpenLiveChat}>
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  {t('emailConnect.openLiveChat', 'Open Live Chat')}
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={handleDoneAfterCreate}>
                                  {t('emailConnect.done', 'Done')}
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>

                      {/* Right: Connected accounts */}
                      <Card className="flex h-full min-h-0 flex-col">
                        <CardHeader className="shrink-0">
                          <CardTitle>{t('emailConnect.rightTitle', 'Connected accounts')}</CardTitle>
                          <CardDescription>{t('emailConnect.rightDescription', 'List of email accounts connected to CRM.')}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex min-h-0 flex-1 flex-col">
                          {connections.length === 0 ? (
                            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                              <Mail className="mb-3 h-12 w-12 text-slate-300" />
                              <p className="text-sm text-slate-600">
                                {t('emailConnect.noConnectedAccounts', 'No email account connected.')}
                              </p>
                            </div>
                          ) : (
                            <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {connections.map((conn) => (
                                <div key={conn.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft">
                                        <Mail className="h-5 w-5 text-brand-blue" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-900">{conn.email_address}</p>
                                        <p className="mt-0.5 truncate text-xs text-slate-500">
                                          {conn.connection_method === 'imap'
                                            ? t('emailConnect.methodImap', 'IMAP langsung')
                                            : conn.inbound_address}
                                        </p>
                                        <span
                                          className={cn(
                                            'mt-1 inline-flex text-xs font-medium',
                                            conn.status === 'verified' || conn.confirmation_code ? 'text-green-600' : 'text-amber-600',
                                          )}
                                        >
                                          {conn.status === 'verified' || conn.confirmation_code
                                            ? t('emailConnect.statusVerified', 'Verified')
                                            : t('emailConnect.statusPending', 'Pending verification')}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleOpenLiveChat}
                                        className="border-brand-blue/30 text-brand-blue hover:bg-brand-blue-soft"
                                      >
                                        <MessageCircle className="mr-1 h-4 w-4" />
                                        {t('emailConnect.liveChat', 'Live Chat')}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-red-200 text-red-600"
                                        onClick={() => handleRemoveConnection(conn)}
                                      >
                                        <Unplug className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <EmailConnectionVerifyPanel
                                    connection={conn}
                                    onOpenLiveChat={handleOpenLiveChat}
                                    onSyncImap={handleSyncImap}
                                    isSyncingImap={syncImapMutation.isPending}
                                  />
                                </div>
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
              </ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>
      {showSkeleton ? (
        <div
          className="absolute inset-0 z-20 overflow-hidden"
          aria-busy
          aria-label={t('emailConnect.loading', 'Loading...')}
        >
          <EmailConnectPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
