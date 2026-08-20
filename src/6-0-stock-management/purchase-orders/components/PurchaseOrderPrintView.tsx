import { formatToRupiah } from "@/shared/utils/formatCurrency";
import type { PurchaseOrderDetail } from "../types";

export function PurchaseOrderPrintView({ detail }: { detail: PurchaseOrderDetail }) {
  const supplier = detail.supplier;

  return (
    <div
      id="purchase-order-print-root"
      className="pointer-events-none fixed inset-0 z-[9999] hidden bg-white print:block"
    >
      <div className="space-y-4 p-6 text-sm text-black">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-lg font-semibold">Purchase Order Detail</h1>
          <div className="text-right text-xs uppercase">{detail.status}</div>
        </div>

        {supplier ? (
          <div className="space-y-1">
            <div className="font-semibold">{supplier.name}</div>
            {supplier.phone ? <div>Telephone: {supplier.phone}</div> : null}
            {supplier.email ? <div>Email: {supplier.email}</div> : null}
            {supplier.address ? <div>Address: {supplier.address}</div> : null}
            {supplier.city ? <div>City: {supplier.city}</div> : null}
            {supplier.state ? <div>State: {supplier.state}</div> : null}
            {supplier.zip ? <div>Zip: {supplier.zip}</div> : null}
          </div>
        ) : null}

        <div className="space-y-1 border-t pt-3">
          <div>Outlet Name: {detail.outletName}</div>
          <div>PO Number: {detail.orderNumber}</div>
          {detail.note ? <div>Note: {detail.note}</div> : null}
        </div>

        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Qty</th>
              <th className="py-2 pr-2">Unit Cost</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-200">
                <td className="py-2 pr-2">{line.name}</td>
                <td className="py-2 pr-2 tabular-nums">{line.qty}</td>
                <td className="py-2 pr-2 tabular-nums">{formatToRupiah(line.unitCost)}</td>
                <td className="py-2 text-right tabular-nums">{formatToRupiah(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="py-2 font-semibold">
                Total
              </td>
              <td className="py-2 text-right font-semibold tabular-nums">
                {formatToRupiah(detail.totalValue)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
