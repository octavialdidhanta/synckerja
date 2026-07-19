import { useParams } from 'react-router-dom';
import { EcommerceChatModuleShell } from '../layout/EcommerceChatModuleShell';
import { EcommerceChatInboxPanel } from '../components/EcommerceChatInboxPanel';
import { parseEcommerceChatPlatform } from '../lib/ecommerceChatPaths';

/**
 * `/operations/sales/ecommerce-chat` (+ optional `/:platform`)
 * Dedicated inbox shell for marketplace chats (Shopee, TikTok Shop, Blibli).
 */
export default function EcommerceChatPage() {
  const { platform: platformParam } = useParams<{ platform?: string }>();
  const platform = parseEcommerceChatPlatform(platformParam);

  return (
    <EcommerceChatModuleShell>
      <EcommerceChatInboxPanel platform={platform} />
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </EcommerceChatModuleShell>
  );
}
