import { describe, expect, it } from "vitest";
import { isSharingIncomplete, resolveReceiptDisplay } from "./resolveReceiptDisplay";

describe("resolveReceiptDisplay", () => {
  it("uses business name as title when outlet logo is missing", () => {
    const display = resolveReceiptDisplay({
      outletName: "Outlet 1",
      businessName: "bisnis baru",
      city: "Kota Jakarta Barat",
      province: "DKI Jakarta",
      postalCode: "11710",
      phone: "+62 81286663811",
      hasOutletLogo: false,
      footerNotes: "Terima kasih",
    });
    expect(display.title).toBe("bisnis baru");
    expect(display.addressLine).toBe("Kota Jakarta Barat, DKI Jakarta, 11710");
    expect(display.notes).toBe("Terima kasih");
  });

  it("uses outlet name as title when outlet logo is set and keeps business name in address", () => {
    const display = resolveReceiptDisplay({
      outletName: "Kremlin",
      businessName: "bisnis baru",
      city: "Kota Jakarta Barat",
      province: "DKI Jakarta",
      postalCode: "11710",
      phone: "+62 81286663811",
      hasOutletLogo: true,
      footerNotes: "",
    });
    expect(display.title).toBe("Kremlin");
    expect(display.addressLine).toBe("bisnis baru, Kota Jakarta Barat, DKI Jakarta, 11710");
  });
});

describe("isSharingIncomplete", () => {
  it("is incomplete when toggles and urls are empty", () => {
    expect(
      isSharingIncomplete({
        shareViaEmail: false,
        shareViaSms: false,
        websiteUrl: "",
        twitterUrl: "",
        facebookUrl: "",
        instagramUrl: "",
        tiktokUrl: "",
        whatsappUrl: "",
      }),
    ).toBe(true);
  });

  it("is complete when a social url is set", () => {
    expect(
      isSharingIncomplete({
        shareViaEmail: false,
        shareViaSms: false,
        websiteUrl: "",
        twitterUrl: "",
        facebookUrl: "https://facebook.com/shop",
        instagramUrl: "",
        tiktokUrl: "",
        whatsappUrl: "",
      }),
    ).toBe(false);
  });
});
