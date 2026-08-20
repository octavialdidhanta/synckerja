import { recordOfflineSale } from '@/stock-management/lib/inventoryApi';
import { applyCatalogCheckoutStock } from '@/stock-management/catalog-ledger/applyCatalogCheckoutStock';
import type { CustomerVisitCartLine } from './customerVisitCheckout.types';
import { catalogCheckoutSaleLines, offlineSalePayloads } from './storeCheckoutStock';

export async function applyStoreCheckoutOfflineSales(args: {
  organizationId: string;
  activityId: string;
  lines: CustomerVisitCartLine[];
}): Promise<void> {
  const payloads = offlineSalePayloads(args.activityId, args.lines);
  for (const payload of payloads) {
    try {
      await recordOfflineSale(args.organizationId, payload.skuId, payload.qty, 'Store checkout', {
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
      });
    } catch (err) {
      console.error('applyStoreCheckoutOfflineSales', payload.skuId, args.activityId, err);
    }
  }
  try {
    await applyCatalogCheckoutStock({
      organizationId: args.organizationId,
      activityId: args.activityId,
      lines: catalogCheckoutSaleLines(args.lines),
    });
  } catch (err) {
    console.error('applyStoreCheckoutCatalogStock', args.activityId, err);
  }
}
