import { countTemplateParameterSlots } from '@/5-3-whatsapp-template/utils/buildCampaignTemplateParameters';

export type LivechatFollowUpPrefillContext = {
  customerName: string | null;
  ticketId: string;
  agentName: string;
  customerWaId: string;
};

/** Fill N template slots cycling conversation context (agent may edit before send). */
export function buildLivechatFollowUpPrefill(
  slotCount: number,
  ctx: LivechatFollowUpPrefillContext,
): string[] {
  if (slotCount <= 0) return [];
  const name = (ctx.customerName ?? '').trim() || '—';
  const ticket = ctx.ticketId.trim() || '—';
  const agent = ctx.agentName.trim() || '—';
  const phone = ctx.customerWaId.replace(/\D/g, '') || ctx.customerWaId.trim() || '—';
  const pool = [name, ticket, agent, phone, name, ticket];
  const out: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const v = String(pool[i % pool.length] ?? '').slice(0, 1024);
    out.push(v.length > 0 ? v : '—');
  }
  return out;
}

export function slotCountForTemplateComponents(components: unknown[] | null | undefined): number {
  return countTemplateParameterSlots(components ?? []);
}
