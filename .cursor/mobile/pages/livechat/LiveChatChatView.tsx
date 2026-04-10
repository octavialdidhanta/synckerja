import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLivechatProfilePhoto } from '@/features/5-3-whatsapp/hooks/useLivechatProfilePhoto';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
import { useVisualViewport } from '@/mobile/hooks/useVisualViewport';
import { Avatar, AvatarFallback, AvatarImage } from '@/features/ui/avatar';
import { Button } from '@/features/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/mobile/components/ui/sheet';
import { SlidersHorizontal, User, Mail } from 'lucide-react';
import type { LiveChatConversation, WhatsAppConversation, InstagramConversation } from '@/features/5-3-whatsapp/types';
import type { WhatsAppAccount } from '@/features/5-3-whatsapp/types';
import { ChatThread } from '@/features/5-3-whatsapp/components/inbox/ChatThread';
import { EmailChatThread } from '@/features/5-3-whatsapp/components/inbox/EmailChatThread';
import { MobileLivechatQuickActionPanel } from './components/MobileLivechatQuickActionPanel';

function ChannelIcon({ channel = 'whatsapp', className }: { channel?: string; className?: string }) {
  const c = (channel || 'whatsapp').toLowerCase();
  if (c === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.268 4.771 1.691 5.077 4.97.06 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.296 3.225-1.824 4.771-5.077 4.97-1.266.06-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.194-4.771-1.691-5.077-4.97-.06-1.265-.07-1.644-.07-4.849 0-3.205.013-3.583.07-4.849.299-3.267 1.817-4.771 5.077-4.97 1.266-.059 1.645-.07 4.849-.07zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162z" />
      </svg>
    );
  }
  if (c === 'email') {
    return <Mail className={className} />;
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function maskPhoneLast4(phone: string | null | undefined): string {
  if (phone == null || phone === '') return '';
  const s = String(phone).trim();
  if (s.length <= 4) return '****';
  return s.slice(0, -4) + '****';
}

interface LiveChatChatViewProps {
  selectedConversation: LiveChatConversation;
  onBack: () => void;
  waAccounts: WhatsAppAccount[];
  scrollToTextInChat?: string | null;
  scrollToMessageId?: string | null;
  onScrollToTextDone?: () => void;
  onScrollToMessageDone?: () => void;
}

export function LiveChatChatView({
  selectedConversation,
  onBack,
  waAccounts,
  scrollToTextInChat,
  scrollToMessageId,
  onScrollToTextDone,
  onScrollToMessageDone,
}: LiveChatChatViewProps) {
  const { t } = useAppTranslation();
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const { height: viewportHeight, mainFixedStyle } = useVisualViewport();
  const isKeyboardOpen =
    typeof window !== 'undefined' &&
    viewportHeight > 0 &&
    viewportHeight < window.innerHeight * 0.85;

  const isEmail = selectedConversation.source === 'email';
  const isInstagram = selectedConversation.source === 'instagram';
  const waConv = selectedConversation as WhatsAppConversation;
  const channel = isInstagram ? 'instagram' : (waConv.channel ?? 'whatsapp');
  const { profileUrl } = useLivechatProfilePhoto(selectedConversation.id, {
    source: selectedConversation.source,
    channel: isEmail ? 'email' : channel,
  });

  const displayName = isEmail
    ? (selectedConversation as { from_display_name?: string; from_email?: string }).from_display_name ||
      (selectedConversation as { from_email?: string }).from_email ||
      'Email'
    : isInstagram
      ? (selectedConversation as InstagramConversation).customer_name ||
        maskPhoneLast4((selectedConversation as InstagramConversation).customer_ig_id) ||
        t('whatsappInbox.instagramContact', 'Kontak Instagram')
      : selectedConversation.customer_name ||
        maskPhoneLast4(waConv.customer_wa_id) ||
        'Unknown';

  const subText = !isEmail && !isInstagram && waConv.customer_wa_id
    ? maskPhoneLast4(waConv.customer_wa_id)
    : null;

  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const overlayColor = channel === 'instagram' ? 'bg-[#E4405F]' : isEmail ? 'bg-blue-600' : 'bg-[#25D366]';

  const connectedPhoneNumberIds = waAccounts.map((a) => a.phone_number_id);
  const hasNoConnectedWhatsAppAccount = waAccounts.length === 0;

  return (
    <div className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
      <header className="flex-shrink-0 sticky top-0 z-20 flex items-center gap-1 pl-0 pr-3 py-2 min-h-[56px] border-b border-slate-700 bg-slate-800 safe-area-top">
        <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 -ml-1 -mr-1 text-white hover:bg-slate-700 hover:text-white" onClick={onBack} aria-label={t('common.back', 'Back')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 rounded-full bg-slate-600 border-2 border-slate-600">
            <AvatarImage src={profileUrl ?? undefined} alt={displayName} className="object-cover" />
            <AvatarFallback className="rounded-full bg-slate-600 text-white text-sm font-medium">
              {initials || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-800 ${overlayColor} text-white`}
            aria-hidden
          >
            <ChannelIcon channel={isEmail ? 'email' : channel} className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">{displayName}</h2>
          {subText && <p className="text-xs text-slate-300 truncate">{subText}</p>}
        </div>
        <Sheet open={quickActionOpen} onOpenChange={setQuickActionOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-white hover:bg-slate-700 hover:text-white" aria-label={t('whatsappInbox.quickAction', 'Quick Action')}>
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            underSafeArea
            className="w-full max-w-sm overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
          >
            <SheetHeader className="space-y-0.5">
              <SheetTitle>{t('whatsappInbox.quickAction', 'Quick Action')}</SheetTitle>
              <p className="text-center text-sm text-muted-foreground">{displayName}</p>
            </SheetHeader>
            <div className="mt-4">
              <MobileLivechatQuickActionPanel conversation={selectedConversation} hideLeadTitle />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {selectedConversation.source === 'email' ? (
          <EmailChatThread conversation={selectedConversation} hideHeader />
        ) : (
          <ChatThread
            conversation={selectedConversation}
            connectedPhoneNumberIds={connectedPhoneNumberIds}
            hasNoConnectedWhatsAppAccount={hasNoConnectedWhatsAppAccount}
            hideHeader
            keyboardOpen={isKeyboardOpen}
            scrollToTextInChat={scrollToTextInChat}
            scrollToMessageId={scrollToMessageId}
            onScrollToTextDone={onScrollToTextDone}
            onScrollToMessageDone={onScrollToMessageDone}
          />
        )}
      </div>
    </div>
  );
}
