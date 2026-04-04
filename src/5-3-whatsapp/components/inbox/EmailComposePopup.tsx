import React, { useState, useRef, useEffect } from 'react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Paperclip, Send, X, FileText } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useIsMobile } from '@/mobile/hooks/use-mobile';

/** Same accept as WhatsApp ChatThread for consistency. */
const ACCEPT_ATTACHMENTS = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_MB = 10;

interface AttachmentItem {
  file: File;
  previewUrl?: string;
}

export interface EmailComposePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled To (recipient). */
  toEmail: string;
  /** Pre-filled subject (e.g. Re: ...). */
  defaultSubject: string;
  /** Pre-filled body (e.g. quoted reply). */
  defaultBody?: string;
  /** Called when user sends. */
  onSend: (params: {
    subject: string;
    body: string;
    to?: string;
    cc?: string;
    bcc?: string;
    attachments: Array<{ filename: string; content: string }>;
  }) => Promise<void>;
  isSending?: boolean;
}

export function EmailComposePopup({
  open,
  onOpenChange,
  toEmail,
  defaultSubject,
  defaultBody = '',
  onSend,
  isSending = false,
}: EmailComposePopupProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const [to, setTo] = useState(toEmail);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTo(toEmail);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setShowCcBcc(false);
      setCc('');
      setBcc('');
      setAttachments([]);
    }
  }, [open, toEmail, defaultSubject, defaultBody]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const maxBytes = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
    const list: AttachmentItem[] = [];
    for (let i = 0; i < files.length && attachments.length + list.length < MAX_ATTACHMENTS; i++) {
      const file = files[i];
      if (file.size > maxBytes) continue;
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      list.push({ file, previewUrl });
    }
    setAttachments((prev) => {
      const combined = [...prev, ...list];
      return combined.slice(0, MAX_ATTACHMENTS);
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      next.splice(index, 1);
      return next;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const handleSend = async () => {
    const bodyTrim = body.trim();
    if (!bodyTrim) return;
    const attachmentPayloads: Array<{ filename: string; content: string }> = [];
    for (const item of attachments) {
      const base64 = await fileToBase64(item.file);
      attachmentPayloads.push({ filename: item.file.name, content: base64 });
    }
    await onSend({
      subject: subject.trim(),
      body: bodyTrim,
      to: to.trim() || undefined,
      cc: cc.trim() || undefined,
      bcc: bcc.trim() || undefined,
      attachments: attachmentPayloads,
    });
    /* Parent closes popup on success */
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col p-0 gap-0 overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area'
            : 'max-w-2xl w-[95vw] max-h-[90vh]'
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
            isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'px-4 py-3 bg-[#e8f0fe] border-gray-200'
          )}
        >
          <DialogTitle className={cn('font-semibold', isMobile ? 'text-lg text-foreground' : 'text-base font-medium text-gray-800')}>
            {t('emailConnect.newMessage', 'Pesan Baru')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto seamless-scroll flex flex-col min-h-0">
          {/* To */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
            <Label className="text-sm text-gray-600 w-12 shrink-0">{t('emailConnect.to', 'Kepada')}</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 border-0 border-b border-transparent focus-visible:ring-0 focus-visible:border-gray-300 rounded-none px-1 py-1.5 h-auto text-sm"
            />
            <button
              type="button"
              onClick={() => setShowCcBcc((v) => !v)}
              className="text-sm text-blue-600 hover:text-blue-800 shrink-0"
            >
              {t('emailConnect.ccBcc', 'Cc Bcc')}
            </button>
          </div>

          {showCcBcc && (
            <>
              <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <Label className="text-sm text-gray-600 w-12 shrink-0">Cc</Label>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder=""
                  className="flex-1 border-0 rounded-none px-1 py-1.5 h-auto text-sm"
                />
              </div>
              <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <Label className="text-sm text-gray-600 w-12 shrink-0">Bcc</Label>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder=""
                  className="flex-1 border-0 rounded-none px-1 py-1.5 h-auto text-sm"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
            <Label className="text-sm text-gray-600 w-12 shrink-0">{t('emailConnect.subject', 'Subject')}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('emailConnect.subjectPlaceholder', 'Subjek')}
              className="flex-1 border-0 rounded-none px-1 py-1.5 h-auto text-sm focus-visible:ring-0"
            />
          </div>

          {/* Message body */}
          <div className="flex-1 min-h-[200px] px-4 py-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('emailConnect.replyPlaceholder', 'Type your reply...')}
              className="min-h-[180px] w-full resize-none border-0 focus-visible:ring-0 text-sm p-0 placeholder:text-gray-400"
              disabled={isSending}
            />
          </div>

          {/* Attachments list (WhatsApp-style) */}
          {attachments.length > 0 && (
            <div className="flex-shrink-0 px-4 pb-2 flex flex-wrap gap-2">
              {attachments.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 border border-gray-200"
                >
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <span className="text-sm text-gray-700 truncate max-w-[120px]" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-7 w-7"
                    onClick={() => removeAttachment(index)}
                    title={t('whatsappInbox.removeAttachment', 'Remove attachment')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Footer: per modal-android-fullscreen.mdc on mobile */}
          <div
            className={cn(
              'flex-shrink-0 border-t flex items-center gap-2',
              isMobile ? 'px-4 pt-3 pb-3 bg-muted/30' : 'px-4 py-3 border-gray-200 bg-white justify-between'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTACHMENTS}
              className="hidden"
              multiple
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('shrink-0', isMobile ? 'h-9 w-9' : 'h-9 w-9')}
              disabled={isSending || attachments.length >= MAX_ATTACHMENTS}
              onClick={() => fileInputRef.current?.click()}
              title={t('whatsappInbox.attachMedia', 'Attach image, video, or document')}
              aria-label={t('whatsappInbox.attachMedia', 'Attach image, video, or document')}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <div className="flex items-center justify-end gap-2 flex-1">
              {isMobile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={isSending}
                >
                  {t('common.cancel', 'Batal')}
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSend}
                disabled={isSending || !body.trim()}
                size={isMobile ? 'sm' : undefined}
                className={cn(
                  isMobile && 'min-w-[120px] flex items-center justify-center gap-1.5',
                  !isMobile && 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('emailConnect.sending', 'Mengirim...')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t('emailConnect.send', 'Kirim')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
