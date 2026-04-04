import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useEmailMessages } from '../../hooks/useEmailMessages';
import { useSendEmailReply } from '../../hooks/useSendEmailReply';
import type { EmailConversation, EmailMessage } from '../../types';
import { Mail, Copy, Reply } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '@/shared/components/ui/button';
import { EmailComposePopup } from './EmailComposePopup';

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

/** Sanitize email body and make URLs clickable (linkify plain text). */
function sanitizeEmailBody(body: string): string {
  if (!body?.trim()) return '';
  const trimmed = body.trim();
  const looksLikeHtml = /</.test(trimmed);
  const toSanitize = looksLikeHtml
    ? trimmed
    : trimmed.replace(
        /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi,
        (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      );
  return DOMPurify.sanitize(toSanitize, { ADD_ATTR: ['target', 'rel'] });
}

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

/** True only when the message looks like a Gmail/email verification (forwarding) email, so we show the confirmation code box only then. */
function isVerificationEmail(msg: EmailMessage): boolean {
  const subj = (msg.subject ?? '').toLowerCase();
  const body = (msg.body ?? '').toLowerCase();
  const verificationPhrases = [
    'confirmation code',
    'verification code',
    'paste in gmail',
    'forwarding and pop/imap',
    'gmail forwarding',
    'forwarding address',
    'kode konfirmasi',
    'penerusan dan pop/imap',
  ];
  const text = `${subj} ${body}`;
  return verificationPhrases.some((p) => text.includes(p));
}

export function EmailChatThread({ conversation, hideHeader }: EmailChatThreadProps) {
  const { t } = useAppTranslation();
  const { data: messages = [], isLoading, isError, refetch } = useEmailMessages(conversation.id);
  const { sendReply, isSending } = useSendEmailReply();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeInitialSubject, setComposeInitialSubject] = useState('');
  const [composeInitialBody, setComposeInitialBody] = useState('');

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
      <div className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 min-w-0 flex flex-col pb-2">
        {messages.map((msg) => {
          const senderDisplay = getMessageSenderDisplay(msg, conversation);
          const isOutbound = msg.direction === 'outbound';
          return (
            <article
              key={msg.id}
              className="shrink-0 w-full bg-white border-b border-slate-200"
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
              <div className="px-4 pb-4 min-w-0">
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
                ) : null}
                {msg.body ? (
                  <div className="min-w-0 w-full max-w-full overflow-x-auto">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      {t('emailConnect.messageLabel', 'Pesan')}:
                    </p>
                    <div
                      className="email-body email-body-responsive text-sm text-slate-800 min-w-0 w-full max-w-full leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-a:text-blue-600 prose-a:underline prose-a:break-words prose-img:max-w-full prose-img:h-auto prose-img:rounded"
                      dangerouslySetInnerHTML={{ __html: sanitizeEmailBody(msg.body) }}
                    />
                  </div>
                ) : null}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => handleReplyToMessage(msg)}
                    disabled={isSending}
                    title={t('emailConnect.replyFromMessage', 'Reply and quote this message')}
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
      <div className="flex-shrink-0 sticky bottom-0 left-0 right-0 z-10 pt-1 pb-2.5 px-3 border-t border-slate-700 bg-slate-800 safe-area-bottom">
        <Button
          type="button"
          variant="outline"
          className="w-full mb-1.5 border-slate-400 bg-white text-slate-800 hover:bg-slate-100 hover:text-slate-900"
          onClick={handleOpenCompose}
          disabled={isSending}
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
