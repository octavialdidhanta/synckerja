import { isValidPublicCode, normalizePublicCode } from "./publicCode";

export const DEFAULT_ORDER_HOSTNAME = "order.synckerja.com";

export type OrderStoreMode = "dinein" | "pickup";

export type OrderStoreQuery = {
  mode?: OrderStoreMode | string | null;
  tableNumber?: string | null;
  category?: string | null;
  categoryDetail?: string | null;
};

export function publicOrderHostname(): string {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? String(import.meta.env?.VITE_PUBLIC_ORDER_HOSTNAME ?? "").trim()
      : "";
  return fromEnv || DEFAULT_ORDER_HOSTNAME;
}

export function publicOrderOrigin(): string {
  return `https://${publicOrderHostname()}`;
}

export function parseOrderStoreMode(value: string | null | undefined): OrderStoreMode {
  return value?.trim().toLowerCase() === "pickup" ? "pickup" : "dinein";
}

export function buildOrderStorePath(code: string, query: OrderStoreQuery = {}): string {
  const normalized = normalizePublicCode(code);
  const params = new URLSearchParams();
  const mode = parseOrderStoreMode(query.mode ?? "dinein");
  params.set("mode", mode);
  const table = (query.tableNumber ?? "").trim();
  if (table) params.set("tableNumber", table);
  const category = (query.category ?? "").trim();
  if (category) params.set("category", category);
  const detail = (query.categoryDetail ?? "").trim();
  if (detail) params.set("categoryDetail", detail);
  return `/${normalized}?${params.toString()}`;
}

export function buildOrderStoreUrl(code: string, query: OrderStoreQuery = {}): string {
  return `${publicOrderOrigin()}${buildOrderStorePath(code, query)}`;
}

export function isOrderStoreHostname(hostname: string, expected = publicOrderHostname()): boolean {
  return hostname.trim().toLowerCase() === expected.trim().toLowerCase();
}

/** Loopback or RFC1918 / unique-local — used so a phone on the same Wi‑Fi can open the storefront via the laptop IP. */
export function isPrivateLanOrLoopbackHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host === "0.0.0.0") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  if (host.includes(":")) {
    return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  }
  return false;
}

export function pathnameLooksLikeOrderStore(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  return isValidPublicCode(first);
}

export function shouldMountOrderStoreApp(input: {
  hostname: string;
  pathname?: string;
  expectedHost?: string;
  allowLanStorefront?: boolean;
}): boolean {
  if (isOrderStoreHostname(input.hostname, input.expectedHost)) return true;
  if (!input.allowLanStorefront) return false;
  if (!isPrivateLanOrLoopbackHostname(input.hostname)) return false;
  return pathnameLooksLikeOrderStore(input.pathname ?? "/");
}
