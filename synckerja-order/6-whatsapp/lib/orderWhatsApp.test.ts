import { describe, expect, it } from "vitest";
import {
  buildOrderWhatsAppUrl,
  fillOrderWhatsAppMessage,
  orderWhatsAppAccountLabel,
  phoneDigits,
  resolveOutletWhatsAppAccountId,
} from "./orderWhatsApp";

const A = { id: "a", businessName: "Toko A", displayPhoneNumber: "+62 812-1111-2222" };
const B = { id: "b", businessName: "Toko B", displayPhoneNumber: "+62 813-3333-4444" };

describe("phoneDigits", () => {
  it("strips non-digits", () => {
    expect(phoneDigits("+62 812-1111-2222")).toBe("6281211112222");
    expect(phoneDigits(null)).toBe("");
  });
});

describe("fillOrderWhatsAppMessage", () => {
  it("fills outlet and table placeholders", () => {
    expect(
      fillOrderWhatsAppMessage("Halo {outlet}, meja {meja}", { outletName: "PIK", tableName: "5" }),
    ).toBe("Halo PIK, meja 5");
  });

  it("uses the table-aware default when empty", () => {
    expect(fillOrderWhatsAppMessage("", { outletName: "PIK", tableName: "5" })).toBe(
      "Halo PIK, saya di meja 5, mau tanya soal pesanan.",
    );
    expect(fillOrderWhatsAppMessage(null, { outletName: "PIK" })).toBe(
      "Halo PIK, saya mau tanya soal pesanan.",
    );
  });

  it("collapses spaces left by an empty {meja}", () => {
    expect(fillOrderWhatsAppMessage("Halo {outlet} meja {meja} ya", { outletName: "PIK" })).toBe(
      "Halo PIK meja ya",
    );
  });
});

describe("buildOrderWhatsAppUrl", () => {
  it("builds wa.me link with encoded text", () => {
    expect(buildOrderWhatsAppUrl("6281211112222", "Halo & tes")).toBe(
      "https://wa.me/6281211112222?text=Halo%20%26%20tes",
    );
  });

  it("rejects too-short numbers", () => {
    expect(buildOrderWhatsAppUrl("123")).toBeNull();
  });
});

describe("orderWhatsAppAccountLabel", () => {
  it("joins name and phone", () => {
    expect(orderWhatsAppAccountLabel(A)).toBe("Toko A · +62 812-1111-2222");
    expect(orderWhatsAppAccountLabel({ id: "x", businessName: null, displayPhoneNumber: null })).toBe(
      "WhatsApp",
    );
  });
});

describe("resolveOutletWhatsAppAccountId", () => {
  it("never auto-picks, even with a single account", () => {
    expect(resolveOutletWhatsAppAccountId({ buttonEnabled: true, selectedAccountId: null, accounts: [A] })).toBeNull();
    expect(resolveOutletWhatsAppAccountId({ buttonEnabled: true, selectedAccountId: "a", accounts: [A] })).toBe("a");
  });

  it("needs a pick when there are several accounts", () => {
    expect(
      resolveOutletWhatsAppAccountId({ buttonEnabled: true, selectedAccountId: null, accounts: [A, B] }),
    ).toBeNull();
    expect(
      resolveOutletWhatsAppAccountId({ buttonEnabled: true, selectedAccountId: "b", accounts: [A, B] }),
    ).toBe("b");
  });

  it("hides when disabled or the pick is gone", () => {
    expect(resolveOutletWhatsAppAccountId({ buttonEnabled: false, selectedAccountId: "a", accounts: [A] })).toBeNull();
    expect(resolveOutletWhatsAppAccountId({ buttonEnabled: true, selectedAccountId: "z", accounts: [A, B] })).toBeNull();
  });
});
