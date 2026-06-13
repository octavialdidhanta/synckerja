import {
  tiktokShopApiBase,
  tiktokShopAuthAuthorizeBase,
  tiktokShopAuthTokenBase,
  type TikTokShopPlatformOAuth,
} from "./tiktokShopAuth.ts";
import { computeTikTokShopSign } from "./tiktokShopSign.ts";

type TikTokShopApiEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
  request_id?: string;
};

export type TikTokShopTokenResult = {
  access_token: string;
  refresh_token: string;
  seller_open_id: string;
  seller_name?: string;
  seller_base_region?: string;
  access_token_expire_in?: number;
  refresh_token_expire_in?: number;
};

export type TikTokShopAuthorizedShop = {
  shop_id: string;
  shop_cipher: string;
  shop_name: string;
  region?: string;
  seller_type?: string;
};

function throwApiError(prefix: string, message?: string, code?: number): never {
  const detail = message?.trim() || (code != null ? `code ${code}` : "unknown");
  throw new Error(`${prefix}: ${detail}`);
}

function parseEnvelope<T>(
  json: TikTokShopApiEnvelope<T>,
  prefix: string,
  options?: { allowEmptyData?: boolean },
): T {
  const code = json.code;
  const message = json.message?.trim() ?? "";
  if (code !== 0 && code !== undefined) {
    throwApiError(prefix, message, code);
  }
  if (json.data === undefined || json.data === null) {
    if (options?.allowEmptyData) {
      return {} as T;
    }
    throwApiError(prefix, message || "empty data");
  }
  return json.data;
}

export function buildTikTokShopSellerAuthUrl(
  oauth: TikTokShopPlatformOAuth,
  state: string,
): string {
  const params = new URLSearchParams({
    service_id: oauth.serviceId,
    state,
  });
  return `${tiktokShopAuthAuthorizeBase()}/open/authorize?${params.toString()}`;
}

export async function exchangeTikTokShopAuthCode(
  oauth: TikTokShopPlatformOAuth,
  authCode: string,
): Promise<TikTokShopTokenResult> {
  const code = authCode.trim();
  if (!code) throw new Error("token_exchange_failed: missing auth_code");

  const params = new URLSearchParams({
    app_key: oauth.appKey,
    app_secret: oauth.appSecret,
    auth_code: code,
    grant_type: "authorized_code",
  });
  const url = `${tiktokShopAuthTokenBase()}/api/v2/token/get?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({})) as TikTokShopApiEnvelope<Record<string, unknown>>;
  if (!res.ok) {
    throwApiError("token_exchange_failed", json.message, json.code ?? res.status);
  }
  const data = parseEnvelope(json, "token_exchange_failed");
  return normalizeTokenResult(data);
}

export async function refreshTikTokShopAccessToken(
  oauth: TikTokShopPlatformOAuth,
  refreshToken: string,
): Promise<TikTokShopTokenResult | null> {
  const token = refreshToken.trim();
  if (!token) return null;

  const params = new URLSearchParams({
    app_key: oauth.appKey,
    app_secret: oauth.appSecret,
    refresh_token: token,
    grant_type: "refresh_token",
  });
  const url = `${tiktokShopAuthTokenBase()}/api/v2/token/refresh?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  const json = await res.json().catch(() => ({})) as TikTokShopApiEnvelope<Record<string, unknown>>;
  if (!res.ok || (json.code !== 0 && json.code !== undefined)) {
    console.warn("refreshTikTokShopAccessToken:", json.message ?? res.status);
    return null;
  }
  if (!json.data) return null;
  return normalizeTokenResult(json.data);
}

function normalizeTokenResult(data: Record<string, unknown>): TikTokShopTokenResult {
  const accessToken = String(data.access_token ?? "").trim();
  const refreshToken = String(data.refresh_token ?? "").trim();
  const openId = String(data.open_id ?? data.seller_open_id ?? "").trim();
  const sellerName = data.seller_name != null ? String(data.seller_name).trim() : undefined;
  const sellerBaseRegion = data.seller_base_region != null
    ? String(data.seller_base_region).trim()
    : undefined;

  let sellerOpenId = openId;
  if (!sellerOpenId) {
    const fallbackName = sellerName ?? "seller";
    const region = sellerBaseRegion ?? "unknown";
    sellerOpenId = `fallback_${fallbackName}_${region}`.replace(/\s+/g, "_").slice(0, 120);
  }

  if (!accessToken) throw new Error("token_exchange_failed: missing access_token");

  const accessExpire = parseExpireSeconds(data.access_token_expire_in ?? data.access_token_expires_in);
  const refreshExpire = parseExpireSeconds(data.refresh_token_expire_in ?? data.refresh_token_expires_in);

  return {
    access_token: accessToken,
    refresh_token: refreshToken || accessToken,
    seller_open_id: sellerOpenId,
    seller_name: sellerName,
    seller_base_region: sellerBaseRegion,
    access_token_expire_in: accessExpire,
    refresh_token_expire_in: refreshExpire,
  };
}

function parseExpireSeconds(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/**
 * TikTok Shop token responses use absolute Unix expiry timestamps (seconds), not TTL duration.
 * Values below 1e9 are treated as TTL seconds from now (legacy fallback).
 */
export function tokenExpiresAtIsoFromTikTokField(
  raw: unknown,
  nowMs = Date.now(),
): string | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000_000) {
    const ms = n >= 1_000_000_000_000 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  return new Date(nowMs + n * 1000).toISOString();
}

export type TikTokShopOrderRow = {
  order_id: string;
  status: string;
  create_time: number | null;
  gmv: number;
  currency: string;
  units_sold: number;
  buyer_message?: string | null;
};

export type TikTokShopOrderSearchResult = {
  orders: TikTokShopOrderRow[];
  total_count: number | null;
  next_page_token: string | null;
};

const TIKTOK_SHOP_DEFAULT_CURRENCY = "IDR";

function parseTikTokShopMoneyValue(
  raw: unknown,
  fallbackCurrency = TIKTOK_SHOP_DEFAULT_CURRENCY,
): { amount: number; currency: string } {
  if (raw == null || raw === "") {
    return { amount: 0, currency: fallbackCurrency };
  }

  if (typeof raw === "number" || typeof raw === "string") {
    const n = Number(raw);
    return { amount: Number.isFinite(n) ? n : 0, currency: fallbackCurrency };
  }

  if (Array.isArray(raw) && raw.length > 0) {
    return parseTikTokShopMoneyValue(raw[0], fallbackCurrency);
  }

  if (typeof raw === "object") {
    const p = raw as Record<string, unknown>;
    const currency = String(
      p.currency ??
        p.currency_code ??
        p.currency_name ??
        p.currencyName ??
        fallbackCurrency,
    ).trim() || fallbackCurrency;

    const amountCandidates = [
      p.sale_price_decimal,
      p.sale_price,
      p.amount,
      p.tax_exclusive_price,
      p.original_price,
      p.price,
      p.value,
    ];

    for (const candidate of amountCandidates) {
      if (candidate == null || candidate === "") continue;
      if (typeof candidate === "object") {
        const nested = parseTikTokShopMoneyValue(candidate, currency);
        if (nested.amount !== 0 || nested.currency !== fallbackCurrency) return nested;
        continue;
      }
      const n = Number(candidate);
      if (Number.isFinite(n)) return { amount: n, currency };
    }

    return { amount: 0, currency };
  }

  return { amount: 0, currency: fallbackCurrency };
}

function parseOrderAmount(payment: unknown): { gmv: number; currency: string } {
  if (!payment || typeof payment !== "object") {
    return { gmv: 0, currency: TIKTOK_SHOP_DEFAULT_CURRENCY };
  }
  const p = payment as Record<string, unknown>;
  const parsed = parseTikTokShopMoneyValue(
    p.total_amount ??
      p.original_total_product_price ??
      p.sub_total ??
      p.product_price ??
      payment,
    String(p.currency ?? p.currency_code ?? TIKTOK_SHOP_DEFAULT_CURRENCY).trim() ||
      TIKTOK_SHOP_DEFAULT_CURRENCY,
  );
  return { gmv: parsed.amount, currency: parsed.currency };
}

function parseOrderUnits(lineItems: unknown): number {
  if (!Array.isArray(lineItems)) return 0;
  let units = 0;
  for (const item of lineItems) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const qty = Number(row.quantity ?? row.sku_quantity ?? row.product_quantity ?? 1);
    units += Number.isFinite(qty) && qty > 0 ? qty : 1;
  }
  return units;
}

function normalizeTikTokShopOrder(raw: Record<string, unknown>): TikTokShopOrderRow | null {
  const orderId = String(raw.id ?? raw.order_id ?? "").trim();
  if (!orderId) return null;
  const status = String(raw.status ?? raw.order_status ?? "UNKNOWN").trim() || "UNKNOWN";
  const createRaw = raw.create_time ?? raw.created_time;
  const createTime = createRaw != null && Number.isFinite(Number(createRaw))
    ? Math.floor(Number(createRaw))
    : null;
  const payment = raw.payment ?? raw.payment_info;
  const { gmv, currency } = parseOrderAmount(payment);
  const units = parseOrderUnits(raw.line_items ?? raw.line_item_list ?? raw.items);
  return {
    order_id: orderId,
    status,
    create_time: createTime,
    gmv,
    currency,
    units_sold: units,
    buyer_message: raw.buyer_message != null ? String(raw.buyer_message) : null,
  };
}

function aggregateOrderSummary(orders: TikTokShopOrderRow[]): {
  gmv: number;
  units_sold: number;
  currency: string;
} {
  let gmv = 0;
  let units = 0;
  let currency = TIKTOK_SHOP_DEFAULT_CURRENCY;
  for (const order of orders) {
    gmv += order.gmv;
    units += order.units_sold;
    if (order.currency) currency = order.currency;
  }
  return { gmv, units_sold: units, currency };
}

export async function searchTikTokShopOrders(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
  options: {
    createTimeGe: number;
    createTimeLt: number;
    pageSize?: number;
    pageToken?: string;
    orderStatus?: string;
  },
): Promise<TikTokShopOrderSearchResult> {
  const cipher = shopCipher.trim();
  if (!cipher) throw new Error("tiktok_shop_api: missing shop_cipher");

  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const query: Record<string, string> = {
    shop_cipher: cipher,
    page_size: String(pageSize),
  };
  if (options.pageToken?.trim()) {
    query.page_token = options.pageToken.trim();
  }

  const body: Record<string, unknown> = {
    create_time_ge: options.createTimeGe,
    create_time_lt: options.createTimeLt,
  };
  if (options.orderStatus?.trim()) {
    body.order_status = options.orderStatus.trim();
  }

  const data = await signedTikTokShopRequest<Record<string, unknown>>(
    oauth,
    accessToken,
    "POST",
    "/order/202309/orders/search",
    {
      query,
      body,
      allowEmptyData: true,
    },
  );

  const rawOrders = (data.orders ?? data.order_list ?? []) as Array<Record<string, unknown>>;
  const orders = rawOrders
    .map((row) => normalizeTikTokShopOrder(row))
    .filter((row): row is TikTokShopOrderRow => row != null);

  const totalRaw = data.total_count ?? data.total ?? data.order_count;
  const totalCount = totalRaw != null && Number.isFinite(Number(totalRaw))
    ? Math.floor(Number(totalRaw))
    : null;

  const nextPage = data.next_page_token ?? data.page_token;
  const nextPageToken = nextPage != null && String(nextPage).trim()
    ? String(nextPage).trim()
    : null;

  return { orders, total_count: totalCount, next_page_token: nextPageToken };
}

export function summarizeTikTokShopOrders(orders: TikTokShopOrderRow[]): {
  gmv: number;
  units_sold: number;
  currency: string;
} {
  return aggregateOrderSummary(orders);
}

export type TikTokShopOrderLineItem = {
  sku_id: string;
  seller_sku: string;
  product_name: string;
  quantity: number;
  sale_price: number;
  currency: string;
};

export type TikTokShopOrderDetail = TikTokShopOrderRow & {
  update_time: number | null;
  shipping_type: string | null;
  tracking_number: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  payment_subtotal: number | null;
  payment_shipping: number | null;
  payment_tax: number | null;
  payment_discount: number | null;
  line_items: TikTokShopOrderLineItem[];
};

function parseAddressText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const parts = [
    a.full_address,
    a.address_line1 ?? a.address_line_1,
    a.address_line2 ?? a.address_line_2,
    a.address_detail,
    a.district,
    a.city,
    a.state,
    a.region,
    a.postal_code ?? a.zipcode,
    a.country,
  ]
    .map((p) => (p != null ? String(p).trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function parseOrderLineItems(raw: unknown): TikTokShopOrderLineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: TikTokShopOrderLineItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const sku = row.sku_id ?? row.skuId;
    const sellerSku = row.seller_sku ?? row.sellerSku ?? sku;
    const name = String(row.product_name ?? row.product_title ?? row.title ?? sellerSku ?? "Item").trim();
    const qty = Number(row.quantity ?? row.sku_quantity ?? 1);
    const priceSource = row.sale_price ?? row.original_price ?? row.price ?? row.price_info;
    const { amount: price, currency: parsedCurrency } = parseTikTokShopMoneyValue(priceSource);
    const currency = String(
      row.currency ?? row.currency_code ?? row.currency_name ?? parsedCurrency,
    ).trim() || parsedCurrency;
    items.push({
      sku_id: sku != null ? String(sku) : "",
      seller_sku: sellerSku != null ? String(sellerSku) : "",
      product_name: name,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
      sale_price: price,
      currency,
    });
  }
  return items;
}

function normalizeTikTokShopOrderDetail(raw: Record<string, unknown>): TikTokShopOrderDetail | null {
  const base = normalizeTikTokShopOrder(raw);
  if (!base) return null;
  const updateRaw = raw.update_time ?? raw.updated_time;
  const updateTime = updateRaw != null && Number.isFinite(Number(updateRaw))
    ? Math.floor(Number(updateRaw))
    : null;
  const payment = raw.payment ?? raw.payment_info;
  let paymentSubtotal: number | null = null;
  let paymentShipping: number | null = null;
  let paymentTax: number | null = null;
  let paymentDiscount: number | null = null;
  if (payment && typeof payment === "object") {
    const p = payment as Record<string, unknown>;
    const sub = Number(p.sub_total ?? p.original_total_product_price);
    const ship = Number(p.shipping_fee ?? p.shipping_amount);
    const tax = Number(p.tax ?? p.total_tax);
    const disc = Number(p.seller_discount ?? p.platform_discount ?? p.discount);
    if (Number.isFinite(sub)) paymentSubtotal = sub;
    if (Number.isFinite(ship)) paymentShipping = ship;
    if (Number.isFinite(tax)) paymentTax = tax;
    if (Number.isFinite(disc)) paymentDiscount = disc;
  }
  const recipient = raw.recipient_address ?? raw.shipping_address ?? raw.delivery_address;
  const recipientObj = recipient && typeof recipient === "object"
    ? recipient as Record<string, unknown>
    : null;
  const packages = raw.packages ?? raw.package_list;
  let tracking: string | null = null;
  if (Array.isArray(packages) && packages[0] && typeof packages[0] === "object") {
    const pkg = packages[0] as Record<string, unknown>;
    tracking = pkg.tracking_number != null ? String(pkg.tracking_number) : null;
  }
  return {
    ...base,
    update_time: updateTime,
    shipping_type: raw.shipping_type != null ? String(raw.shipping_type) : null,
    tracking_number: tracking ?? (raw.tracking_number != null ? String(raw.tracking_number) : null),
    recipient_name: recipientObj?.name != null ? String(recipientObj.name) : null,
    recipient_phone: recipientObj?.phone_number != null
      ? String(recipientObj.phone_number)
      : recipientObj?.phone != null
        ? String(recipientObj.phone)
        : null,
    recipient_address: parseAddressText(recipient),
    payment_subtotal: paymentSubtotal,
    payment_shipping: paymentShipping,
    payment_tax: paymentTax,
    payment_discount: paymentDiscount,
    line_items: parseOrderLineItems(raw.line_items ?? raw.line_item_list ?? raw.items),
  };
}

export async function getTikTokShopOrderDetails(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
  orderIds: string[],
): Promise<{ orders: TikTokShopOrderDetail[] }> {
  const cipher = shopCipher.trim();
  if (!cipher) throw new Error("tiktok_shop_api: missing shop_cipher");
  const ids = orderIds.map((id) => id.trim()).filter(Boolean).slice(0, 50);
  if (ids.length === 0) throw new Error("tiktok_shop_api: missing order ids");

  const data = await signedTikTokShopRequest<Record<string, unknown>>(
    oauth,
    accessToken,
    "GET",
    "/order/202309/orders",
    {
      query: {
        shop_cipher: cipher,
        ids: ids.join(","),
      },
      allowEmptyData: true,
    },
  );

  const rawOrders = (data.orders ?? data.order_list ?? []) as Array<Record<string, unknown>>;
  const orders = rawOrders
    .map((row) => normalizeTikTokShopOrderDetail(row))
    .filter((row): row is TikTokShopOrderDetail => row != null);
  return { orders };
}

export const TIKTOK_SHOP_MAX_SUMMARY_PAGES = 20;

export type TikTokShopOrderPeriodSummary = {
  gmv: number;
  order_count: number;
  units_sold: number;
  currency: string;
  pages_fetched: number;
  truncated: boolean;
};

export async function aggregateOrderSearchPages(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
  options: {
    createTimeGe: number;
    createTimeLt: number;
    orderStatus?: string;
    maxPages?: number;
  },
): Promise<TikTokShopOrderPeriodSummary> {
  const maxPages = Math.min(Math.max(options.maxPages ?? TIKTOK_SHOP_MAX_SUMMARY_PAGES, 1), 50);
  const allOrders: TikTokShopOrderRow[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;
  let totalCount: number | null = null;
  let truncated = false;

  while (pagesFetched < maxPages) {
    const result = await searchTikTokShopOrders(oauth, accessToken, shopCipher, {
      createTimeGe: options.createTimeGe,
      createTimeLt: options.createTimeLt,
      pageSize: 50,
      pageToken,
      orderStatus: options.orderStatus,
    });
    allOrders.push(...result.orders);
    if (result.total_count != null) totalCount = result.total_count;
    pagesFetched++;
    if (!result.next_page_token) break;
    pageToken = result.next_page_token;
    if (pagesFetched >= maxPages) {
      truncated = true;
      break;
    }
  }

  const summary = summarizeTikTokShopOrders(allOrders);
  return {
    gmv: summary.gmv,
    order_count: totalCount ?? allOrders.length,
    units_sold: summary.units_sold,
    currency: summary.currency,
    pages_fetched: pagesFetched,
    truncated,
  };
}

export type TikTokShopProductSku = {
  sku_id: string;
  seller_sku: string;
  price: number;
  currency: string;
  stock: number | null;
};

export type TikTokShopProductRow = {
  product_id: string;
  title: string;
  status: string;
  create_time: number | null;
  update_time: number | null;
  skus: TikTokShopProductSku[];
};

export type TikTokShopProductSearchResult = {
  products: TikTokShopProductRow[];
  total_count: number | null;
  next_page_token: string | null;
};

function parseSkuStockFromRow(row: Record<string, unknown>): number | null {
  const direct = row.stock ?? row.available_stock ?? row.quantity;
  if (direct != null && Number.isFinite(Number(direct))) {
    return Math.floor(Number(direct));
  }

  const stockInfos = row.stock_infos ?? row.stockInfos;
  if (Array.isArray(stockInfos)) {
    let total = 0;
    let found = false;
    for (const item of stockInfos) {
      if (!item || typeof item !== "object") continue;
      const info = item as Record<string, unknown>;
      const qty = info.available_stock ?? info.stock ?? info.quantity;
      if (qty != null && Number.isFinite(Number(qty))) {
        total += Math.floor(Number(qty));
        found = true;
      }
    }
    if (found) return total;
  }

  const inventory = row.inventory;
  if (Array.isArray(inventory)) {
    let total = 0;
    let found = false;
    for (const item of inventory) {
      if (!item || typeof item !== "object") continue;
      const inv = item as Record<string, unknown>;
      const qty = inv.quantity ?? inv.available_stock ?? inv.stock;
      if (qty != null && Number.isFinite(Number(qty))) {
        total += Math.floor(Number(qty));
        found = true;
      }
    }
    if (found) return total;
  }

  if (inventory != null && typeof inventory === "object" && !Array.isArray(inventory)) {
    const inv = inventory as Record<string, unknown>;
    const qty = inv.quantity ?? inv.available_stock ?? inv.stock;
    if (qty != null && Number.isFinite(Number(qty))) {
      return Math.floor(Number(qty));
    }
  }

  return null;
}

function parseProductSkus(raw: unknown): TikTokShopProductSku[] {
  if (!Array.isArray(raw)) return [];
  const skus: TikTokShopProductSku[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const skuId = String(row.id ?? row.sku_id ?? "").trim();
    const sellerSku = String(row.seller_sku ?? row.sellerSku ?? skuId).trim();
    const priceSource = row.price ?? row.price_info ?? row.original_price ?? row.sale_price;
    const { amount: price, currency: parsedCurrency } = parseTikTokShopMoneyValue(priceSource);
    const currency = String(
      row.currency ?? row.currency_code ?? row.currency_name ?? parsedCurrency,
    ).trim() || parsedCurrency;
    const stock = parseSkuStockFromRow(row);
    skus.push({ sku_id: skuId, seller_sku: sellerSku, price, currency, stock });
  }
  return skus;
}

function normalizeTikTokShopProduct(raw: Record<string, unknown>): TikTokShopProductRow | null {
  const productId = String(raw.id ?? raw.product_id ?? "").trim();
  if (!productId) return null;
  const title = String(raw.title ?? raw.product_name ?? raw.name ?? productId).trim();
  const status = String(raw.status ?? raw.product_status ?? "UNKNOWN").trim() || "UNKNOWN";
  const createRaw = raw.create_time ?? raw.created_time;
  const updateRaw = raw.update_time ?? raw.updated_time;
  const createTime = createRaw != null && Number.isFinite(Number(createRaw))
    ? Math.floor(Number(createRaw))
    : null;
  const updateTime = updateRaw != null && Number.isFinite(Number(updateRaw))
    ? Math.floor(Number(updateRaw))
    : null;
  return {
    product_id: productId,
    title,
    status,
    create_time: createTime,
    update_time: updateTime,
    skus: parseProductSkus(raw.skus ?? raw.sku_list ?? raw.sku),
  };
}

export async function searchTikTokShopProducts(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
  options: {
    pageSize?: number;
    pageToken?: string;
    status?: string;
  },
): Promise<TikTokShopProductSearchResult> {
  const cipher = shopCipher.trim();
  if (!cipher) throw new Error("tiktok_shop_api: missing shop_cipher");

  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 100);
  const query: Record<string, string> = {
    shop_cipher: cipher,
    page_size: String(pageSize),
  };
  if (options.pageToken?.trim()) {
    query.page_token = options.pageToken.trim();
  }

  const body: Record<string, unknown> = {};
  if (options.status?.trim()) {
    body.status = options.status.trim();
  }

  const data = await signedTikTokShopRequest<Record<string, unknown>>(
    oauth,
    accessToken,
    "POST",
    "/product/202309/products/search",
    {
      query,
      body,
      allowEmptyData: true,
    },
  );

  const rawProducts = (data.products ?? data.product_list ?? []) as Array<Record<string, unknown>>;
  const products = rawProducts
    .map((row) => normalizeTikTokShopProduct(row))
    .filter((row): row is TikTokShopProductRow => row != null);

  const totalRaw = data.total_count ?? data.total ?? data.product_count;
  const totalCount = totalRaw != null && Number.isFinite(Number(totalRaw))
    ? Math.floor(Number(totalRaw))
    : null;

  const nextPage = data.next_page_token ?? data.page_token;
  const nextPageToken = nextPage != null && String(nextPage).trim()
    ? String(nextPage).trim()
    : null;

  return { products, total_count: totalCount, next_page_token: nextPageToken };
}

export type TikTokShopWarehouseRow = {
  warehouse_id: string;
  warehouse_name?: string;
  type?: string;
};

function isValidTikTokWarehouseId(value: string | undefined | null): boolean {
  const id = String(value ?? "").trim();
  return id.length > 0 && id !== "default" && /^\d+$/.test(id);
}

export async function listTikTokShopWarehouses(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
): Promise<TikTokShopWarehouseRow[]> {
  const cipher = shopCipher.trim();
  if (!cipher) throw new Error("tiktok_shop_api: missing shop_cipher");

  const data = await signedTikTokShopRequest<{ warehouses?: Array<Record<string, unknown>> }>(
    oauth,
    accessToken,
    "GET",
    "/logistics/202309/warehouses",
    { query: { shop_cipher: cipher } },
  );

  return (data.warehouses ?? [])
    .map((row) => ({
      warehouse_id: String(row.warehouse_id ?? row.id ?? "").trim(),
      warehouse_name: row.warehouse_name != null ? String(row.warehouse_name).trim() : undefined,
      type: row.type != null ? String(row.type).trim() : undefined,
    }))
    .filter((row) => row.warehouse_id);
}

async function resolveTikTokShopWarehouseId(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
  preferredId?: string,
): Promise<string> {
  if (isValidTikTokWarehouseId(preferredId)) {
    return String(preferredId).trim();
  }

  const warehouses = await listTikTokShopWarehouses(oauth, accessToken, shopCipher);
  if (warehouses.length === 0) {
    throw new Error("tiktok_shop_api: no warehouses found for shop");
  }

  const salesWarehouse = warehouses.find((w) => w.type === "SALES_WAREHOUSE");
  return (salesWarehouse ?? warehouses[0]).warehouse_id;
}

export async function updateTikTokShopSkuStock(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  shopCipher: string,
  options: {
    productId: string;
    skuId: string;
    quantity: number;
    warehouseId?: string;
  },
): Promise<void> {
  const cipher = shopCipher.trim();
  const productId = options.productId.trim();
  const skuId = options.skuId.trim();
  if (!cipher || !productId || !skuId) {
    throw new Error("tiktok_shop_api: missing shop_cipher, product_id, or sku_id");
  }

  const qty = Math.max(0, Math.floor(options.quantity));
  const warehouseId = await resolveTikTokShopWarehouseId(
    oauth,
    accessToken,
    cipher,
    options.warehouseId,
  );

  const inventoryEntry: Record<string, unknown> = {
    warehouse_id: warehouseId,
    quantity: qty,
  };

  const body = {
    skus: [
      {
        id: skuId,
        inventory: [inventoryEntry],
        stock_infos: [{ warehouse_id: warehouseId, available_stock: qty }],
      },
    ],
  };

  const query: Record<string, string> = { shop_cipher: cipher };

  await signedTikTokShopRequest<Record<string, unknown>>(
    oauth,
    accessToken,
    "POST",
    `/product/202309/products/${encodeURIComponent(productId)}/inventory/update`,
    { query, body },
  );
}

/** Cache key segment for dashboard pagination + optional order status filter. */
export function buildTikTokShopOrdersCachePageToken(
  pageToken: string,
  orderStatus?: string,
): string {
  const status = orderStatus?.trim() ?? "";
  const token = pageToken.trim();
  if (!status) return token;
  return `${status}::${token}`;
}

export const TIKTOK_SHOP_PERIOD_SUMMARY_CACHE_TOKEN = "__period_summary_v1__";

function extractApiVersionFromPath(apiPath: string): string | null {
  const match = apiPath.match(/\/(20\d{4})\//);
  return match?.[1] ?? null;
}

function buildSignedQueryParams(
  oauth: TikTokShopPlatformOAuth,
  apiPath: string,
  extraQuery?: Record<string, string>,
): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params: Record<string, string> = {
    app_key: oauth.appKey,
    timestamp,
    ...(extraQuery ?? {}),
  };
  const version = extractApiVersionFromPath(apiPath);
  if (version) {
    params.version = version;
  } else {
    // Legacy-style endpoints (non-versioned path) still expect sign_method.
    params.sign_method = "HmacSHA256";
  }
  return params;
}

export async function signedTikTokShopRequest<T>(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
  method: "GET" | "POST",
  apiPath: string,
  options?: {
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    allowEmptyData?: boolean;
  },
): Promise<T> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const bodyObj = options?.body ?? {};
  const bodyStr = method === "GET" ? "" : JSON.stringify(bodyObj);

  const queryParams = buildSignedQueryParams(oauth, path, options?.query);

  const sign = await computeTikTokShopSign({
    path,
    queryParams,
    body: bodyStr,
    appSecret: oauth.appSecret,
  });

  const urlParams = new URLSearchParams({
    ...queryParams,
    sign,
    access_token: accessToken,
  });
  const url = `${tiktokShopApiBase()}${path}?${urlParams.toString()}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-tts-access-token": accessToken,
    },
    ...(method === "POST" ? { body: bodyStr } : {}),
  });

  const json = await res.json().catch(() => ({})) as TikTokShopApiEnvelope<T>;
  if (!res.ok) {
    throwApiError("tiktok_shop_api", json.message, json.code ?? res.status);
  }
  return parseEnvelope(json, "tiktok_shop_api", {
    allowEmptyData: options?.allowEmptyData,
  });
}

export async function getTikTokShopAuthorizedShops(
  oauth: TikTokShopPlatformOAuth,
  accessToken: string,
): Promise<TikTokShopAuthorizedShop[]> {
  const data = await signedTikTokShopRequest<{ shops?: Array<Record<string, unknown>> }>(
    oauth,
    accessToken,
    "GET",
    "/authorization/202309/shops",
  );

  const shops = data.shops ?? [];
  return shops.map((shop) => {
    const shopId = String(shop.id ?? shop.shop_id ?? "").trim();
    const cipher = String(shop.cipher ?? shop.shop_cipher ?? "").trim();
    const name = String(shop.name ?? shop.shop_name ?? shopId).trim();
    return {
      shop_id: shopId,
      shop_cipher: cipher,
      shop_name: name || shopId,
      region: shop.region != null ? String(shop.region).trim() : undefined,
      seller_type: shop.seller_type != null ? String(shop.seller_type).trim() : undefined,
    };
  }).filter((s) => s.shop_id && s.shop_cipher);
}
