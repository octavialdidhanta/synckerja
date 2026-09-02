import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOrderStorePath,
  buildOrderStoreUrl,
  parseOrderStoreMode,
  pathnameLooksLikeOrderStore,
  publicOrderOrigin,
  shouldMountOrderStoreApp,
} from "./orderUrls";

describe("orderUrls", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults mode to dinein and includes tableNumber", () => {
    expect(buildOrderStorePath("kremlin", { tableNumber: "B14" })).toBe(
      "/kremlin?mode=dinein&tableNumber=B14",
    );
  });

  it("parses pickup mode", () => {
    expect(parseOrderStoreMode("pickup")).toBe("pickup");
    expect(parseOrderStoreMode("dinein")).toBe("dinein");
    expect(parseOrderStoreMode(null)).toBe("dinein");
  });

  it("mounts storefront on public hostname and on LAN IP in local dev", () => {
    expect(pathnameLooksLikeOrderStore("/h5gta6")).toBe(true);
    expect(pathnameLooksLikeOrderStore("/employees")).toBe(false);
    expect(
      shouldMountOrderStoreApp({
        hostname: "order.synckerja.com",
        pathname: "/",
        expectedHost: "order.synckerja.com",
      }),
    ).toBe(true);
    expect(
      shouldMountOrderStoreApp({
        hostname: "192.168.1.68",
        pathname: "/h5gta6",
        expectedHost: "order.synckerja.com",
        allowLanStorefront: true,
      }),
    ).toBe(true);
    expect(
      shouldMountOrderStoreApp({
        hostname: "192.168.1.68",
        pathname: "/h5gta6",
        expectedHost: "order.synckerja.com",
        allowLanStorefront: false,
      }),
    ).toBe(false);
    expect(
      shouldMountOrderStoreApp({
        hostname: "192.168.1.68",
        pathname: "/",
        expectedHost: "order.synckerja.com",
        allowLanStorefront: true,
      }),
    ).toBe(false);
  });

  it("uses VITE_PUBLIC_ORDER_ORIGIN when set", () => {
    vi.stubEnv("VITE_PUBLIC_ORDER_ORIGIN", "http://192.168.1.129:8080");
    expect(publicOrderOrigin()).toBe("http://192.168.1.129:8080");
    expect(buildOrderStoreUrl("h5gta6", { mode: "dinein", tableNumber: "meja 1" })).toBe(
      "http://192.168.1.129:8080/h5gta6?mode=dinein&tableNumber=meja+1",
    );
  });
});
