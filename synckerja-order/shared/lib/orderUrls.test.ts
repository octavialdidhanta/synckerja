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

  it("prefixes a valid public code with the outlet name", () => {
    expect(buildOrderStorePath("49eetd", { mode: "dinein" }, "Sate Sultan PIK")).toBe(
      "/sate-sultan-pik-49eetd?mode=dinein",
    );
    expect(pathnameLooksLikeOrderStore("/sate-sultan-pik-49eetd")).toBe(true);
    expect(pathnameLooksLikeOrderStore("/49eetd")).toBe(true);
  });

  it("parses pickup and link modes", () => {
    expect(parseOrderStoreMode("pickup")).toBe("pickup");
    expect(parseOrderStoreMode("link")).toBe("link");
    expect(parseOrderStoreMode("LINK")).toBe("link");
    expect(parseOrderStoreMode("dinein")).toBe("dinein");
    expect(parseOrderStoreMode(null)).toBe("dinein");
    expect(parseOrderStoreMode("promo")).toBe("dinein");
  });

  it("builds the advertising link without a table number", () => {
    expect(buildOrderStorePath("49eetd", { mode: "link" }, "Sate Sultan PIK")).toBe(
      "/sate-sultan-pik-49eetd?mode=link",
    );
  });

  it("mounts storefront on public hostname and on LAN IP in local dev", () => {
    expect(pathnameLooksLikeOrderStore("/h5gta6")).toBe(true);
    expect(pathnameLooksLikeOrderStore("/employees")).toBe(false);
    expect(pathnameLooksLikeOrderStore("/review/2bd0cdcb308544baa48fcde3hgx1onai")).toBe(false);
    expect(
      shouldMountOrderStoreApp({
        hostname: "localhost",
        pathname: "/review/2bd0cdcb308544baa48fcde3hgx1onai",
        expectedHost: "order.synckerja.com",
        allowLanStorefront: true,
      }),
    ).toBe(false);
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
