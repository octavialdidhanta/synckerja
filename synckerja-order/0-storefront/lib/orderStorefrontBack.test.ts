import { describe, expect, it } from "vitest";
import { nextOrderStorefrontBackLayer, type OrderStorefrontBackState } from "./orderStorefrontBack";

function state(patch: Partial<OrderStorefrontBackState> = {}): OrderStorefrontBackState {
  return {
    lightbox: false,
    customize: false,
    cartSheet: false,
    cashierQr: false,
    ticketDetail: false,
    orderHistory: false,
    profile: false,
    checkoutQris: false,
    paymentMethod: false,
    customerInfo: false,
    orderReview: false,
    search: false,
    menu: false,
    category: false,
    ...patch,
  };
}

describe("nextOrderStorefrontBackLayer", () => {
  it("stays on the store when nothing is open", () => {
    expect(nextOrderStorefrontBackLayer(state())).toBeNull();
  });

  it("closes the top overlay before lower layers", () => {
    expect(
      nextOrderStorefrontBackLayer(
        state({ lightbox: true, customize: true, search: true, category: true }),
      ),
    ).toBe("lightbox");
    expect(
      nextOrderStorefrontBackLayer(state({ customize: true, search: true, orderReview: true })),
    ).toBe("customize");
    expect(
      nextOrderStorefrontBackLayer(state({ customize: true, cartSheet: true, search: true })),
    ).toBe("customize");
    expect(nextOrderStorefrontBackLayer(state({ cartSheet: true, search: true }))).toBe("cartSheet");
    expect(nextOrderStorefrontBackLayer(state({ cashierQr: true, profile: true }))).toBe("cashierQr");
    expect(
      nextOrderStorefrontBackLayer(state({ cashierQr: true, ticketDetail: true, orderHistory: true })),
    ).toBe("cashierQr");
    expect(
      nextOrderStorefrontBackLayer(state({ ticketDetail: true, orderHistory: true })),
    ).toBe("ticketDetail");
    expect(nextOrderStorefrontBackLayer(state({ orderHistory: true, profile: true }))).toBe("orderHistory");
    expect(nextOrderStorefrontBackLayer(state({ checkoutQris: true, paymentMethod: true }))).toBe(
      "checkoutQris",
    );
    expect(
      nextOrderStorefrontBackLayer(state({ paymentMethod: true, orderReview: true })),
    ).toBe("paymentMethod");
    expect(nextOrderStorefrontBackLayer(state({ orderReview: true, search: true }))).toBe("orderReview");
    expect(nextOrderStorefrontBackLayer(state({ search: true, menu: true }))).toBe("search");
    expect(nextOrderStorefrontBackLayer(state({ menu: true, category: true }))).toBe("menu");
    expect(nextOrderStorefrontBackLayer(state({ category: true }))).toBe("category");
  });
});
