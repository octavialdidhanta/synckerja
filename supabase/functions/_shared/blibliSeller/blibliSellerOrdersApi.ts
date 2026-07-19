import {
  blibliSellerRequest,
  buildBlibliCommonQuery,
  newBlibliRequestId,
} from "./blibliSellerRequest.ts";
import { readBlibliPlatformConfig, type BlibliPlatformConfig } from "./blibliSellerAuth.ts";

export const BLIBLI_ORDERS_PACKAGES_FILTER_PATH = "/proxy/seller/v1/orders/packages/filter";

export type BlibliOrderPackagesFilterBody = {
  filter?: Record<string, unknown>;
  sorting?: { by?: string; direction?: string };
  paging?: { page?: number; size?: number };
};

export type BlibliOrderPackageGroup = {
  packageId: string | number | null;
  orderItems: Record<string, unknown>[];
};

export type FilterOrderPackagesParams = {
  storeCode: string;
  storeId: number;
  username: string;
  apiSellerKey: string;
  signatureKey?: string | null;
  body: BlibliOrderPackagesFilterBody;
  requestId?: string;
  platform?: BlibliPlatformConfig;
};

export type FilterOrderPackagesSuccess = {
  ok: true;
  requestId: string;
  packages: BlibliOrderPackageGroup[];
  paging: {
    pageNumber: number;
    pageSize: number;
    totalPage: number;
    totalRecord: number;
  };
};

export type FilterOrderPackagesFailure = {
  ok: false;
  status: number;
  errorCode?: string | null;
  errorMessage: string;
  requestId: string;
  raw?: unknown;
};

export type FilterOrderPackagesResult = FilterOrderPackagesSuccess | FilterOrderPackagesFailure;

export function mapBlibliOrderErrorCode(errorCode: string | null | undefined, status: number): string {
  if (errorCode === "ERR-PA400054") return "STORE_UNBOUND";
  if (errorCode === "ERR-MA500007") return "BLIBLI_SERVER_ERROR";
  if (status === 401 || status === 403) return "AUTH_FAILED";
  return errorCode ?? "BLIBLI_ORDERS_FAILED";
}

/**
 * POST /proxy/seller/v1/orders/packages/filter
 */
export async function filterOrderPackages(
  params: FilterOrderPackagesParams,
): Promise<FilterOrderPackagesResult> {
  const platform = params.platform ?? readBlibliPlatformConfig();
  if (!platform) {
    return {
      ok: false,
      status: 503,
      errorMessage: "Blibli platform credentials are not configured",
      requestId: params.requestId ?? "n/a",
    };
  }

  const requestId = params.requestId?.trim() || newBlibliRequestId(platform.channelId);
  const query = buildBlibliCommonQuery({
    requestId,
    storeCode: params.storeCode,
    username: params.username,
    storeId: params.storeId,
    channelId: platform.channelId,
  });
  const pathWithQuery = `${BLIBLI_ORDERS_PACKAGES_FILTER_PATH}?${query}`;
  const bodyStr = JSON.stringify(params.body ?? {});

  const res = await blibliSellerRequest({
    method: "POST",
    pathWithQuery,
    apiSellerKey: params.apiSellerKey,
    signatureKey: params.signatureKey,
    body: bodyStr,
    platform,
  });

  const json = res.json;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status || 502,
      errorCode: typeof json.errorCode === "string" ? json.errorCode : null,
      errorMessage:
        typeof json.errorMessage === "string" && json.errorMessage.trim()
          ? json.errorMessage.trim()
          : `Blibli orders filter failed (${res.status})`,
      requestId: typeof json.requestId === "string" ? json.requestId : requestId,
      raw: json,
    };
  }

  const content = Array.isArray(json.content) ? json.content : [];
  const packages: BlibliOrderPackageGroup[] = content.map((row) => {
    const r = row as Record<string, unknown>;
    const items = Array.isArray(r.orderItems) ? (r.orderItems as Record<string, unknown>[]) : [];
    return {
      packageId: (r.packageId as string | number | null | undefined) ?? null,
      orderItems: items,
    };
  });

  const pagingRaw = (json.paging ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    requestId: typeof json.requestId === "string" ? json.requestId : requestId,
    packages,
    paging: {
      pageNumber: Number(pagingRaw.pageNumber ?? 0) || 0,
      pageSize: Number(pagingRaw.pageSize ?? 10) || 10,
      totalPage: Number(pagingRaw.totalPage ?? 0) || 0,
      totalRecord: Number(pagingRaw.totalRecord ?? 0) || 0,
    },
  };
}
