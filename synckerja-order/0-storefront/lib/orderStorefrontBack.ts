export type OrderStorefrontBackState = {
  lightbox: boolean;
  customize: boolean;
  cartSheet: boolean;
  cashierQr: boolean;
  ticketDetail: boolean;
  orderHistory: boolean;
  profile: boolean;
  checkoutQris: boolean;
  paymentMethod: boolean;
  customerInfo: boolean;
  orderReview: boolean;
  search: boolean;
  menu: boolean;
  category: boolean;
};

export type OrderStorefrontBackLayer = keyof OrderStorefrontBackState;

/** Closest storefront layer that Android/browser Back should close. Null = stay on the store. */
export function nextOrderStorefrontBackLayer(
  state: OrderStorefrontBackState,
): OrderStorefrontBackLayer | null {
  if (state.lightbox) return "lightbox";
  if (state.customize) return "customize";
  if (state.cartSheet) return "cartSheet";
  if (state.cashierQr) return "cashierQr";
  if (state.ticketDetail) return "ticketDetail";
  if (state.orderHistory) return "orderHistory";
  if (state.profile) return "profile";
  if (state.checkoutQris) return "checkoutQris";
  if (state.paymentMethod) return "paymentMethod";
  if (state.customerInfo) return "customerInfo";
  if (state.orderReview) return "orderReview";
  if (state.search) return "search";
  if (state.menu) return "menu";
  if (state.category) return "category";
  return null;
}
