import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useEmailMessages } from '../../hooks/useEmailMessages';
import { useSendEmailReply } from '../../hooks/useSendEmailReply';
import type { EmailConversation, EmailMessage } from '../../types';
import { supabase } from '@/shared/lib/supabaseClient';
import { Mail, Copy, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { EmailComposePopup } from './EmailComposePopup';
import { EmailBodyRenderer } from './EmailBodyRenderer';
import { emailBodyPlainTextForMatch } from '../../utils/formatEmailBodyForDisplay';
import { cn } from '@/shared/lib/utils';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import {
  isAssignedToOtherAgent,
  isConversationUnassigned,
} from '../../utils/assigneeSendGate';

/** Scoped CSS: email body fits viewport; override fixed widths; full-width content tables; collapse spacer columns. */
const emailBodyResponsiveStyles = `
  .email-body-responsive {
    width: 100% !important;
    max-width: 100% !important;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    box-sizing: border-box !important;
  }
  .email-body-responsive > * {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .email-body-responsive table {
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }
  .email-body-responsive td,
  .email-body-responsive th {
    box-sizing: border-box !important;
  }
  .email-body-responsive th.wrapper-margin,
  .email-body-responsive td.wrapper-margin,
  .email-body-responsive th[width="48"],
  .email-body-responsive td[width="48"] {
    width: 0 !important;
    min-width: 0 !important;
    max-width: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    overflow: hidden !important;
    border: none !important;
  }
  .email-body-responsive img {
    max-width: 100% !important;
    height: auto !important;
  }
  .email-body-responsive input,
  .email-body-responsive button {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
`;

interface EmailChatThreadProps {
  conversation: EmailConversation;
  /** When true, hide the in-component header (e.g. for mobile where parent provides back + avatar + name). */
  hideHeader?: boolean;
}

function formatTime(iso: string) {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm');
  } catch {
    return iso;
  }
}

/** Fallback when from_display_name is NULL: humanize local part of email. */
function emailToDisplayLabel(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  const local = email.split('@')[0]?.trim() || email;
  if (!local) return email;
  const withSpaces = local.replace(/[._-]+/g, ' ');
  const titleCase = withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  return titleCase.trim() || email;
}

/** Show nama akun (display name) when set, else fallback label from email, else email. For outbound use connection display. */
function getMessageSenderDisplay(msg: EmailMessage, conversation: EmailConversation): string {
  if (msg.direction === 'outbound' && msg.from_email?.includes('inbound-')) {
    return conversation.email_connection_display ?? msg.from_email ?? '';
  }
  return msg.from_display_name ?? emailToDisplayLabel(msg.from_email) ?? msg.from_email ?? '';
}

/** Strip HTML to plain text for quoting in reply body. */
function stripHtmlToPlain(html: string | null | undefined): string {
  if (html == null || html === '') return '';
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize subject for display: at most one "Re: " (no "Re: Re: ..."). */
function normalizeSubjectForDisplay(subject: string | null | undefined): string {
  if (subject == null || subject === '') return '';
  const s = String(subject).trim();
  const withoutRe = s.replace(/^(Re:\s*)+/i, '').trim();
  return withoutRe ? `Re: ${withoutRe}` : s;
}

/** True only for Gmail/Hostinger email forwarding verification — not OTP, tickets, or LinkedIn security alerts. */
function isVerificationEmail(msg: EmailMessage): boolean {
  const subj = (msg.subject ?? '').toLowerCase();
  const body = emailBodyPlainTextForMatch(msg.body ?? '').toLowerCase();
  const text = `${subj} ${body}`;

  if (
    /linkedin\.com|verifikasi perangkat|device baru|two.step verification|ticket\s*#|\bxendit\b|\bvercel\b|\bsupabase\b|log in code|login code|otp/i.test(
      text,
    )
  ) {
    return false;
  }

  const forwardingPhrases = [
    'confirmation code',
    'kode konfirmasi',
    'paste in gmail',
    'forwarding and pop/imap',
    'penerusan dan pop/imap',
    'gmail forwarding',
    'forwarding address',
    'email forwarder',
    'menunggu konfirmasi',
    'waiting for confirmation',
  ];
  return forwardingPhrases.some((p) => text.includes(p));
}

function isHostingerForwarderVerification(msg: EmailMessage): boolean {
  const text = `${msg.subject ?? ''} ${msg.body ?? ''}`.toLowerCase();
  return text.includes('hostinger') && (text.includes('forward') || text.includes('diteruskan') || text.includes('forwarder'));
}

export function EmailChatThread({ conversation, hideHeader }: EmailChatThreadProps) {
  const { t } = useAppTranslation();
  const { employee } = useCentralizedUserData();
  const currentEmployeeId = employee?.id ?? null;
  const { data: convStatus, isSuccess: convStatusLoaded } = useQuery({
    queryKey: ['email-conversation-status', conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_conversations')
        .select('assignee_id')
        .eq('id', conversation.id)
        .maybeSingle();
      if (error) throw error;
      return data as { assignee_id: string | null } | null;
    },
    refetchInterval: 5000,
  });
  const conversationAssigneeId = convStatusLoaded ? (convStatus?.assignee_id ?? null) : null;
  const sendBlockedUnassigned =
    convStatusLoaded && isConversationUnassigned(conversationAssigneeId);
  const sendBlockedNotAssignee =
    convStatusLoaded && isAssignedToOtherAgent(conversationAssigneeId, currentEmployeeId);
  const sendBlocked = sendBlockedUnassigned || sendBlockedNotAssignee;

  const { data: assigneeEmployeeRow } = useQuery({
    queryKey: ['omnichannel-assignee-display', conversationAssigneeId],
    queryFn: async () => {
      if (!conversationAssigneeId) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('id', conversationAssigneeId)
        .maybeSingle();
      if (error) throw error;
      return data as { full_name?: string | null; email?: string | null } | null;
    },
    enabled: sendBlockedNotAssignee && Boolean(conversationAssigneeId),
    staleTime: 60_000,
  });
  const assigneeDisplayName =
    (assigneeEmployeeRow?.full_name && String(assigneeEmployeeRow.full_name).trim()) ||
    (assigneeEmployeeRow?.email && String(assigneeEmployeeRow.email).trim()) ||
    null;
  const { data: messages = [], isLoading, isError, refetch } = useEmailMessages(conversation.id);
  const { sendReply, isSending } = useSendEmailReply();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitialSubject, setComposeInitialSubject] = useState('');
  const [composeInitialBody, setComposeInitialBody] = useState('');
  const threadScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [conversation.id, messages.length]);

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code).then(() => {
      toast.success(t('emailConnect.copied', 'Address copied to clipboard.'));
    });
  };

  const displayName = conversation.from_display_name || emailToDisplayLabel(conversation.from_email) || conversation.from_email || conversation.email_connection_display || 'Email';

  const lastInboundSubject = messages.filter((m) => m.direction === 'inbound').slice(-1)[0]?.subject;
  const defaultSubject = lastInboundSubject ? `Re: ${lastInboundSubject.replace(/^(Re:\s*)+/i, '').trim() || lastInboundSubject}` : '';
  const subjectForReply = defaultSubject ? (defaultSubject.startsWith('Re:') ? defaultSubject : `Re: ${defaultSubject}`) : '';

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100 p-4">
        <p className="text-sm text-slate-500">{t('whatsappInbox.loadingMessages', 'Loading messages...')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100 p-4 items-center justify-center gap-3">
        <p className="text-sm text-red-600">{t('whatsappInbox.failedToLoadMessages', 'Gagal memuat pesan.')}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t('common.retry', 'Coba lagi')}
        </Button>
      </div>
    );
  }

  const handleReplyToMessage = (msg: EmailMessage) => {
    const senderDisplay = getMessageSenderDisplay(msg, conversation) || msg.from_email || '';
    const plainBody = stripHtmlToPlain(msg.body);
    const dateStr = formatTime(msg.created_at);
    const quotedLine = senderDisplay ? `${t('emailConnect.onDateWrote', 'On {{date}}, {{sender}} wrote:', { date: dateStr, sender: senderDisplay })}` : dateStr;
    const quotedBlock = plainBody ? `${quotedLine}\n${plainBody}` : quotedLine;
    setComposeInitialSubject(subjectForReply);
    setComposeInitialBody(`\n\n${quotedBlock}`);
    setComposeOpen(true);
  };

  const handleOpenCompose = () => {
    setComposeInitialSubject(subjectForReply);
    setComposeInitialBody('');
    setComposeOpen(true);
  };

  const handleSendFromPopup = async (params: {
    subject: string;
    body: string;
    to?: string;
    cc?: string;
    bcc?: string;
    attachments: Array<{ filename: string; content: string }>;
  }) => {
    if (sendBlocked) {
      if (sendBlockedUnassigned) {
        toast.error(
          t(
            'whatsappInbox.assignFromLeadsFirst',
            'Tetapkan assignee di Leads Management sebelum membalas.',
          ),
        );
      } else {
        toast.error(
          t(
            'whatsappInbox.sendOnlyAssignedAgent',
            'Hanya agen yang ditetapkan (assignee) pada chat ini yang dapat membalas.',
          ),
        );
      }
      return;
    }
    try {
      await sendReply({
        conversation_id: conversation.id,
        body: params.body,
        subject: params.subject || defaultSubject || null,
        to: params.to || null,
        cc: params.cc || null,
        bcc: params.bcc || null,
        attachments: params.attachments.length ? params.attachments : undefined,
      });
      toast.success(t('emailConnect.replySent', 'Reply sent.'));
      setComposeOpen(false);
    } catch (err) {
      toast.error((err as Error)?.message ?? t('emailConnect.replyFailed', 'Failed to send reply.'));
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100 items-center justify-center p-4">
        <Mail className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-sm text-slate-600">{t('emailConnect.noMessages', 'No messages yet.')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative bg-slate-100">
      <style dangerouslySetInnerHTML={{ __html: emailBodyResponsiveStyles }} />
      {!hideHeader && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
          <h3 className="font-semibold text-gray-900 truncate">{displayName}</h3>
          <p className="text-xs text-slate-500 truncate">{conversation.email_connection_display ?? ''}</p>
        </div>
      )}
      <div ref={threadScrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden seamless-scroll min-w-0">
        <div className="flex min-h-full flex-1 flex-col">
        {messages.map((msg, index) => {
          const senderDisplay = getMessageSenderDisplay(msg, conversation);
          const isOutbound = msg.direction === 'outbound';
          const isLast = index === messages.length - 1;
          return (
            <article
              key={msg.id}
              className={cn(
                'w-full border-b border-slate-200 bg-white',
                isLast ? 'flex min-h-0 flex-1 flex-col' : 'shrink-0',
              )}
            >
              <div className="px-4 pt-4 pb-2">
                {msg.subject ? (
                  <h2 className="text-base font-semibold text-slate-900 mb-2 break-words">
                    {t('emailConnect.subject', 'Subject')}: {normalizeSubjectForDisplay(msg.subject)}
                  </h2>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mb-3">
                  <span className="break-all">
                    {isOutbound
                      ? t('emailConnect.you', 'Anda')
                      : (senderDisplay || msg.from_email || '—')}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0">{formatTime(msg.created_at)}</span>
                </div>
              </div>
              <div className={cn('px-4 pb-4 min-w-0', isLast && 'flex min-h-0 flex-1 flex-col')}>
                {msg.confirmation_code != null && String(msg.confirmation_code).trim() !== '' && isVerificationEmail(msg) ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4 min-h-0">
                    <p className="text-sm font-medium text-amber-800 mb-2 leading-normal">
                      {t('emailConnect.confirmationCodeLabel', 'Kode konfirmasi (tempel di Gmail → Penerusan dan POP/IMAP)')}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xl font-bold text-amber-900 tracking-wide">{msg.confirmation_code}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(msg.confirmation_code!)}
                        className="p-1.5 rounded hover:bg-amber-100 text-amber-700"
                        title={t('whatsappInbox.copy', 'Copy')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : isHostingerForwarderVerification(msg) ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4 min-h-0">
                    <p className="text-sm font-medium text-amber-900 mb-1">
                      {t('emailConnect.hostingerVerifyTitle', 'Verifikasi forwarder Hostinger')}
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      {t(
                        'emailConnect.hostingerVerifyHint',
                        'Klik link verifikasi di isi email di bawah. Setelah itu status di hPanel berubah dari "Menunggu konfirmasi" menjadi aktif.',
                      )}
                    </p>
                  </div>
                ) : null}
                {msg.body ? (
                  <div className="min-w-0 w-full max-w-full overflow-x-auto">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      {t('emailConnect.messageLabel', 'Pesan')}:
                    </p>
                    <EmailBodyRenderer
                      body={msg.body}
                      className="email-body email-body-responsive text-sm text-slate-800 min-w-0 w-full max-w-full leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-a:text-blue-600 prose-a:underline prose-a:break-words prose-img:max-w-full prose-img:h-auto prose-img:rounded"
                    />
                  </div>
                ) : null}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => handleReplyToMessage(msg)}
                    disabled={isSending || sendBlocked}
                    title={
                      sendBlockedUnassigned
                        ? t(
                            'whatsappInbox.assignFromLeadsFirst',
                            'Tetapkan assignee di Leads Management sebelum membalas.',
                          )
                        : sendBlockedNotAssignee
                          ? t(
                              'whatsappInbox.sendOnlyAssignedAgent',
                              'Hanya agen yang ditetapkan (assignee) pada chat ini yang dapat membalas.',
                            )
                          : t('emailConnect.replyFromMessage', 'Reply and quote this message')
                    }
                  >
                    <Reply className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    {t('emailConnect.reply', 'Balas')}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-slate-700 bg-slate-800 px-3 pb-2.5 pt-1 safe-area-bottom">
        {sendBlocked ? (
          <p className="mb-2 text-center text-xs text-amber-200 px-1">
            {sendBlockedUnassigned
              ? t(
                  'whatsappInbox.assignFromLeadsFirst',
                  'Tetapkan assignee di Leads Management sebelum membalas.',
                )
              : assigneeDisplayName
                ? t(
                    'whatsappInbox.sendOnlyAssignedAgentNamed',
                    'Hanya {{name}} (assignee) yang dapat membalas chat ini.',
                    { name: assigneeDisplayName },
                  )
                : t(
                    'whatsappInbox.sendOnlyAssignedAgent',
                    'Hanya agen yang ditetapkan (assignee) pada chat ini yang dapat membalas.',
                  )}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full mb-1.5 border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"
          onClick={handleOpenCompose}
          disabled={isSending || sendBlocked}
        >
          {t('emailConnect.newMessage', 'Pesan Baru')}
        </Button>
      </div>
      <EmailComposePopup
        open={composeOpen}
        onOpenChange={setComposeOpen}
        toEmail={conversation.from_email ?? ''}
        defaultSubject={composeInitialSubject || subjectForReply}
        defaultBody={composeInitialBody}
        onSend={handleSendFromPopup}
        isSending={isSending}
      />
    </div>
  );
}
