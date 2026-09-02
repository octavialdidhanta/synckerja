import { describe, expect, it } from "vitest";
import {
  buildOrderStorePath,
  parseOrderStoreMode,
  pathnameLooksLikeOrderStore,
  shouldMountOrderStoreApp,
} from "./orderUrls";

describe("orderUrls", () => {
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
});
