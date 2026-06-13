import { describe, expect, it } from "vitest";
import { buildTikTokShopSignString, computeTikTokShopSign } from "./tiktokShopSigning";

describe("tiktokShopSigning", () => {
  it("builds sign string with sorted params excluding sign and access_token", () => {
    const secret = "test_secret";
    const path = "/authorization/202309/shops";
    const params = {
      access_token: "should_be_excluded",
      app_key: "app123",
      sign: "old_sign",
      sign_method: "HmacSHA256",
      timestamp: "1700000000000",
    };
    const signString = buildTikTokShopSignString(path, params, "", secret);
    expect(signString).toBe(
      `${secret}${path}app_keyapp123sign_methodHmacSHA256timestamp1700000000000${secret}`,
    );
  });

  it("appends JSON body for non-GET signing", () => {
    const secret = "s";
    const path = "/api/finance/order/settlements";
    const body = '{"page_number":1,"page_size":1}';
    const params = {
      app_key: "k",
      timestamp: "1",
      sign_method: "HmacSHA256",
    };
    const signString = buildTikTokShopSignString(path, params, body, secret);
    expect(signString).toBe(`${secret}${path}app_keyksign_methodHmacSHA256timestamp1${body}${secret}`);
  });

  it("computes deterministic hex HMAC signature", async () => {
    const sign = await computeTikTokShopSign({
      path: "/authorization/202309/shops",
      queryParams: {
        app_key: "demo",
        timestamp: "1000",
        sign_method: "HmacSHA256",
      },
      body: "",
      appSecret: "secret_key",
    });
    expect(sign).toMatch(/^[0-9a-f]{64}$/);
    const again = await computeTikTokShopSign({
      path: "/authorization/202309/shops",
      queryParams: {
        app_key: "demo",
        timestamp: "1000",
        sign_method: "HmacSHA256",
      },
      body: "",
      appSecret: "secret_key",
    });
    expect(sign).toBe(again);
  });
});
