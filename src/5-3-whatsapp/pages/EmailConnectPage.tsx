import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
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
import { Mail, Plus, ChevronLeft, ChevronDown, Copy, CheckCircle2, Unplug, MessageCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import type { EmailConnection } from '../types';

const EMAIL_INBOUND_DOMAIN = (import.meta.env.VITE_EMAIL_INBOUND_DOMAIN as string)?.trim() || 'chat.example.com';
const IS_INBOUND_DOMAIN_CONFIGURED = EMAIL_INBOUND_DOMAIN !== 'chat.example.com';

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

/** Email providers (well-known only). */
const EMAIL_PROVIDERS = [
  'AOL (TLS)', 'AOL (SSL)',
  'Gmail (TLS)', 'Gmail (SSL)',
  'Outlook (TLS)', 'Outlook (SSL)',
  'Yahoo (TLS)', 'Yahoo (SSL)',
] as const;

/** `/omnichannel/integrations/email` — Seamless Page Scroll Layout (`.cursor/rules/Seamless Page Scroll Layout.mdc`). */
export function EmailConnectPage() {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { connections, isLoading: connectionsLoading, insertConnection, insertConnectionMutation, deleteConnection } =
    useEmailConnections();

  const hasPendingLoad = orgLoading || (!!organizationId && connectionsLoading);
  const [showSkeleton, setShowSkeleton] = useState(hasPendingLoad);

  useEffect(() => {
    if (hasPendingLoad) {
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
  }, [hasPendingLoad]);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [providerOpen, setProviderOpen] = useState(false);
  const [customProvider, setCustomProvider] = useState(false);
  const [createdInboundAddress, setCreatedInboundAddress] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const handleBack = () => {
    setIsAddingEmail(false);
    setCreatedInboundAddress(null);
    setEmail('');
    setPassword('');
    setProvider('');
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
      await insertConnection({
        organization_id: '', // filled in hook
        email_address: emailTrim,
        inbound_address: inboundAddress,
        provider: provider || null,
        status: 'pending_verification',
      });
      setCreatedInboundAddress(inboundAddress);
      toast.success(t('emailConnect.connectionCreated', 'Email connection created. Add the forwarding address in Gmail.'));
    } catch (err) {
      toast.error((err as Error)?.message ?? t('emailConnect.createFailed', 'Failed to create connection.'));
    }
  };
  const handleCopyInboundAddress = () => {
    if (!createdInboundAddress) return;
    void navigator.clipboard.writeText(createdInboundAddress).then(() => {
      setCopiedAddress(true);
      toast.success(t('emailConnect.copied', 'Address copied to clipboard.'));
      setTimeout(() => setCopiedAddress(false), 2000);
    });
  };
  const handleDoneAfterCreate = () => {
    setCreatedInboundAddress(null);
    setIsAddingEmail(false);
    setEmail('');
    setPassword('');
    setProvider('');
  };
  const handleOpenLiveChat = () => navigate("/omnichannel/livechat");
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
                                {t('emailConnect.description', 'Connect your email account to sync conversations and manage leads from email.')}
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
                                onClick={() => setIsAddingEmail(true)}
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
                                      {t('emailConnect.password', 'Password (Encrypted) *')}
                                    </Label>
                                    <Input
                                      id="email-password"
                                      type="password"
                                      placeholder={t('emailConnect.passwordPlaceholder', 'Enter password')}
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      className="w-full h-10 rounded-md border border-input"
                                    />
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
                                  <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={insertConnectionMutation.isPending}
                                  >
                                    {insertConnectionMutation.isPending ? t('emailConnect.submitting', 'Submitting...') : t('emailConnect.submit', 'Submit')}
                                  </Button>
                                </form>
                              </div>
                            </div>
                          )}
                          {createdInboundAddress ? (
                            <div className="space-y-4 rounded-lg border border-green-200 bg-green-50/80 p-4">
                              {!IS_INBOUND_DOMAIN_CONFIGURED ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                  {t('emailConnect.inboundDomainNotConfigured', 'Set VITE_EMAIL_INBOUND_DOMAIN in .env to your Resend inbound domain (e.g. profitloop.id) so Gmail can deliver emails to this address.')}
                                </div>
                              ) : null}
                              <div className="flex items-center gap-2 text-green-800 font-semibold">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                {t('emailConnect.inboundAddressTitle', 'Forwarding address')}
                              </div>
                              <p className="text-sm text-slate-700">
                                {t('emailConnect.inboundAddressInstruction', 'Add this address in Gmail → Settings → Forwarding and POP/IMAP. The confirmation code will appear in Live Chat after Gmail sends the verification email.')}
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-800 break-all">
                                  {createdInboundAddress}
                                </code>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCopyInboundAddress}
                                  className="shrink-0"
                                >
                                  {copiedAddress ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="default" size="sm" onClick={handleOpenLiveChat}>
                                  <MessageCircle className="w-4 h-4 mr-2" />
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
                                        <p className="mt-0.5 truncate text-xs text-slate-500" title={conn.inbound_address}>
                                          {conn.inbound_address}
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
