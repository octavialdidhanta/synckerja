import { formatOrderRp } from "../../lib/formatOrderRp";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";

export function OrderItemCustomizeInfo({
  name,
  price,
  description,
}: {
  name: string;
  price: number;
  description: string | null;
}) {
  return (
    <div className={`border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
      <h1 className="text-[20px] font-bold uppercase leading-tight text-neutral-900">{name}</h1>
      <p className="mt-1 text-[16px] font-semibold text-neutral-900">{formatOrderRp(price)}</p>
      {description ? (
        <p className="mt-2 text-[12px] leading-snug text-neutral-400">{description}</p>
      ) : null}
    </div>
  );
}
