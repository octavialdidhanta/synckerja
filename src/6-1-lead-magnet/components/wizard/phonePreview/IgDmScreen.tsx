import { Image as ImageIcon, Mic, Phone, Plus, Smile, Video } from 'lucide-react';
import type { PhonePreviewModel } from './buildPhonePreviewModel';
import { IgPreviewAvatar } from './IgPostScreen';
import { IgStatusBar } from './IgStatusBar';

type IgDmScreenProps = {
  model: PhonePreviewModel;
  messagePlaceholder: string;
};

export function IgDmScreen({ model, messagePlaceholder }: IgDmScreenProps) {
  const { account, dmMessages } = model;

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <IgStatusBar />

      <div className="flex shrink-0 items-center gap-2 px-3.5 pb-2 pt-1">
        <span className="text-lg leading-none text-white/90" aria-hidden>
          ‹
        </span>
        <IgPreviewAvatar url={account.avatarUrl} name={account.username} size="md" />
        <p className="min-w-0 flex-1 truncate text-[12px] font-semibold">{account.username}</p>
        <Phone className="h-3.5 w-3.5 text-white/90" />
        <Video className="h-3.5 w-3.5 text-white/90" />
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3.5 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dmMessages.map((msg) => {
          if (msg.kind === 'outgoing') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-[#9637ff] px-2.5 py-1.5 text-[11px] leading-snug text-white">
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[90%] overflow-hidden rounded-2xl bg-[#262626] text-[11px] leading-snug text-white">
                <div className="whitespace-pre-wrap px-2.5 py-1.5">{msg.text}</div>
                {msg.buttons && msg.buttons.length > 0 ? (
                  <div className="space-y-1.5 px-2.5 pb-2">
                    {msg.buttons.map((label, i) => (
                      <div
                        key={`${msg.id}-btn-${i}`}
                        className="truncate rounded-lg bg-[#3a3a3c] px-3 py-2 text-center text-[11px] font-medium text-white"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 px-3.5 pb-4 pt-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0095f6]">
          <Mic className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/15 px-2.5 py-1.5 text-[10px] text-white/40">
          {messagePlaceholder}
        </div>
        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-white/70" />
        <Smile className="h-3.5 w-3.5 shrink-0 text-white/70" />
        <Plus className="h-3.5 w-3.5 shrink-0 text-white/70" />
      </div>
    </div>
  );
}
