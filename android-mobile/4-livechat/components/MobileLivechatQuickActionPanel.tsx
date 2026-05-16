import type { ComponentProps } from 'react';
import { LivechatQuickActionPanel } from '@/5-3-whatsapp/components/inbox/LivechatQuickActionPanel';

type MobileLivechatQuickActionPanelProps = ComponentProps<typeof LivechatQuickActionPanel>;

/** Quick action livechat mobile — konten shared + spacer bawah agar field terakhir tidak mentok. */
export function MobileLivechatQuickActionPanel(props: MobileLivechatQuickActionPanelProps) {
  return (
    <div className="flex flex-col">
      <LivechatQuickActionPanel {...props} />
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </div>
  );
}
