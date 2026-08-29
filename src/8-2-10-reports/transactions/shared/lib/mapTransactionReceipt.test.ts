import { describe, expect, it } from "vitest";
import { mapTransactionToPosReceiptTransaction } from "./mapTransactionReceipt";
import type { TransactionReceiptDetail } from "./mapTransactionReceipt";

const baseDetail: TransactionReceiptDetail = {
  salesActivityId: "11111111-1111-1111-1111-111111111111",
  posOutletId: "outlet-1",
  clientName: "Guest",
  clientPhone: null,
  date: "2026-08-28",
  createdAt: "2026-08-28T10:00:00Z",
  totalAmount: 55000,
  totalPaidAmount: 55000,
  checkoutSubtotal: 50000,
  checkoutTaxAmount: 5000,
  checkoutGratuityAmount: 0,
  checkoutDiscountAmount: 2000,
  checkoutDiscountLabel: null,
  paymentMethod: "cash",
  paymentReference: null,
  cashTendered: 60000,
  tableNumber: "T1",
  catalogSalesTypeId: null,
  servedByName: "Alice",
  collectedByName: "Bob",
  items: [
    {
      id: "item-1",
      serviceName: "Milk Tea",
      subServiceName: null,
      quantity: 1,
      unitPrice: 25000,
      totalPrice: 25000,
    },
  ],
  modifiers: [
    {
      salesActivityItemId: "item-1",
      optionName: "Pearl",
      extraPrice: 5000,
      quantity: 1,
    },
  ],
  lineDiscounts: [
    {
      salesActivityItemId: "item-1",
      discountName: "Promo Sultan",
      amountRp: 3000,
    },
  ],
  taxLines: [{ name: "PPN", amount: 5000 }],
  gratuityLines: [],
};

describe("mapTransactionToPosReceiptTransaction", () => {
  it("maps modifiers, promo, global discount, served/collected", () => {
    const tx = mapTransactionToPosReceiptTransaction({
      detail: baseDetail,
      receiptNumber: "SC-11111111",
      datetime: "28 Aug 2026 17:00",
      payMethodLabel: "Cash",
      change: 5000,
    });

    expect(tx.servedBy).toBe("Alice");
    expect(tx.collectedBy).toBe("Bob");
    expect(tx.globalDiscountAmount).toBe(2000);
    expect(tx.lineItems[0].modifiers).toEqual([{ label: "Pearl", price: 5000 }]);
    expect(tx.lineItems[0].promoLabel).toBe("Promo Sultan");
    expect(tx.lineItems[0].promoAmount).toBe(3000);
    expect(tx.taxLines).toEqual([{ name: "PPN", amount: 5000 }]);
    expect(tx.grandTotal).toBe(55000);
    expect(tx.change).toBe(5000);
  });
});
