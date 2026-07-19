/** Status tabs for Blibli Order Management (package filter API). */

export type BlibliOrderStatusTab = 'all' | 'new' | 'in_process' | 'delivered' | 'cancel';

/** Maps UI tab → Blibli `filter.orderItemStatuses` (omit for All). */
export const BLIBLI_ORDER_STATUS_TAB_CODES: Record<
  Exclude<BlibliOrderStatusTab, 'all'>,
  string[]
> = {
  new: ['FP'],
  in_process: ['PU', 'CX', 'BP'],
  delivered: ['D'],
  cancel: ['X', 'OS', 'CR'],
};

export const BLIBLI_ORDER_STATUS_TABS: BlibliOrderStatusTab[] = [
  'all',
  'new',
  'in_process',
  'delivered',
  'cancel',
];

export function orderItemStatusesForTab(tab: BlibliOrderStatusTab): string[] | undefined {
  if (tab === 'all') return undefined;
  return BLIBLI_ORDER_STATUS_TAB_CODES[tab];
}

export function statusBadgeVariant(
  itemStatus: string | null | undefined,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (itemStatus ?? '').toUpperCase();
  if (s === 'FP') return 'destructive';
  if (s === 'D') return 'default';
  if (s === 'X' || s === 'OS' || s === 'CR') return 'outline';
  return 'secondary';
}
