import { useQuery } from '@tanstack/react-query';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { supabase } from '@/shared/lib/supabaseClient';
import type { BlibliOrderStatusTab } from '../lib/blibliOrderStatusTabs';

export type BlibliOrderPackageGroup = {
  packageId: string | number | null;
  orderItems: BlibliOrderItem[];
};

export type BlibliOrderItem = {
  cashlessStatusUpdateSla?: number;
  createdDate?: number;
  flag?: Record<string, boolean>;
  logistic?: {
    awbNumber?: string;
    awbValidityStatus?: string;
    optionCode?: string;
    optionName?: string;
    productCode?: string;
    productName?: string;
    shippingInstruction?: string;
  };
  order?: {
    autoCancelTimestamp?: number;
    customerFullName?: string;
    date?: number;
    id?: string;
    itemId?: string;
    itemStatus?: string;
    quantity?: number;
    recipientConfirmationStatus?: string;
    statusFPUpdatedTimestamp?: number;
    type?: string;
  };
  pickupPoint?: { code?: string; name?: string };
  preOrder?: { active?: boolean; type?: string; value?: number };
  product?: {
    blibliSku?: string;
    finalPrice?: number;
    itemName?: string;
    price?: number;
    sellerSku?: string;
    type?: string;
  };
  sellerDeliveryType?: string;
  storeCode?: string;
};

export type BlibliOrdersPaging = {
  pageNumber: number;
  pageSize: number;
  totalPage: number;
  totalRecord: number;
};

export type BlibliListPackagesResponse = {
  packages: BlibliOrderPackageGroup[];
  paging: BlibliOrdersPaging;
  requestId: string;
  connectionId: string;
  storeCode: string;
};

export type BlibliListPackagesInput = {
  organizationId: string;
  connectionId?: string | null;
  statusTab: BlibliOrderStatusTab;
  searchIds?: string[];
  dateRange?: { start: number; end: number } | null;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  page?: number;
  size?: number;
  enabled?: boolean;
};

async function invokeListPackages(input: BlibliListPackagesInput): Promise<BlibliListPackagesResponse> {
  const filter: Record<string, unknown> = {};
  if (input.dateRange) {
    filter.statusFPDateRange = {
      start: input.dateRange.start,
      end: input.dateRange.end,
    };
  }
  if (input.searchIds && input.searchIds.length > 0) {
    filter.orderOrOrderItemIds = input.searchIds;
  }

  const { data, error } = await supabase.functions.invoke('blibli-seller-orders', {
    body: {
      action: 'listPackages',
      organization_id: input.organizationId,
      ...(input.connectionId ? { connection_id: input.connectionId } : {}),
      status_tab: input.statusTab,
      request_body: {
        filter,
        sorting: {
          by: input.sortBy ?? 'statusFPUpdatedTimestamp',
          direction: input.sortDirection ?? 'DESC',
        },
        paging: {
          page: input.page ?? 0,
          size: input.size ?? 20,
        },
      },
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as BlibliListPackagesResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return {
    packages: (payload.packages ?? []) as BlibliOrderPackageGroup[],
    paging: payload.paging ?? { pageNumber: 0, pageSize: 20, totalPage: 0, totalRecord: 0 },
    requestId: payload.requestId ?? '',
    connectionId: payload.connectionId ?? '',
    storeCode: payload.storeCode ?? '',
  };
}

export function useBlibliOrderPackagesQuery(input: BlibliListPackagesInput) {
  return useQuery({
    queryKey: [
      'blibli-order-packages',
      input.organizationId,
      input.connectionId,
      input.statusTab,
      input.searchIds,
      input.dateRange,
      input.sortBy,
      input.sortDirection,
      input.page,
      input.size,
    ],
    queryFn: () => invokeListPackages(input),
    enabled: Boolean(input.organizationId) && input.enabled !== false,
    staleTime: 30_000,
  });
}
