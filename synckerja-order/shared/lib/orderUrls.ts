import { isValidPublicCode, normalizePublicCode } from "./publicCode";

export const DEFAULT_ORDER_HOSTNAME = "order.synckerja.com";

export type OrderStoreMode = "dinein" | "pickup";

export type OrderStoreQuery = {
  mode?: OrderStoreMode | string | null;
  tableNumber?: string | null;
  category?: string | null;
  categoryDetail?: string | null;
};

function envOrderOrigin(): string {
  const raw =
    typeof import.meta !== "undefined"
      ? String(import.meta.env?.VITE_PUBLIC_ORDER_ORIGIN ?? "").trim()
      : "";
  return raw.replace(/\/$/, "");
}

function envOrderHostname(): string {
  const fromEnv =
    typeof import.meta !== "undefined"
      ? String(import.meta.env?.VITE_PUBLIC_ORDER_HOSTNAME ?? "").trim()
      : "";
  if (fromEnv) return fromEnv;
  const origin = envOrderOrigin();
  if (!origin) return "";
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

export function publicOrderHostname(): string {
  return envOrderHostname() || DEFAULT_ORDER_HOSTNAME;
}

/**
 * Public storefront origin used in QR / share links.
 * - `VITE_PUBLIC_ORDER_ORIGIN` wins (e.g. `http://192.168.1.129:8080` for LAN QR tests)
 * - In Vite DEV, reuse `window.location.origin` so links keep host+port of the running server
 *   (order.synckerja.com on :443 is not your local Vite :8080)
 * - Production default: `https://order.synckerja.com`
 */
export function publicOrderOrigin(): string {
  const fromEnv = envOrderOrigin();
  if (fromEnv) return fromEnv;

  if (typeof import.meta !== "undefined" && import.meta.env?.DEV && typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    if (origin && (isPrivateLanOrLoopbackHostname(hostname) || isOrderStoreHostname(hostname))) {
      return origin.replace(/\/$/, "");
    }
    // Office opened on localhost — still prefer current origin so desktop preview works.
    if (origin) return origin.replace(/\/$/, "");
  }

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
  if (isOrderStoreHostname(input.hostname, input.expectedHost ?? publicOrderHostname())) return true;
  if (!input.allowLanStorefront) return false;
  if (!isPrivateLanOrLoopbackHostname(input.hostname)) return false;
  return pathnameLooksLikeOrderStore(input.pathname ?? "/");
}
