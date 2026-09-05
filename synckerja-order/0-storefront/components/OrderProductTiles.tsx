import { Minus, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { formatOrderRp } from "../lib/formatOrderRp";
import {
  OrderProductRatingBadge,
  type OrderProductRatingSummary,
} from "../ratings";

const ACCENT = "#E91E8C";

export function OrderProductPhoto({
  url,
  alt,
  className,
}: {
  url: string | null | undefined;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden bg-neutral-200 ${className ?? ""}`}>
      {url ? <img src={url} alt={alt} className="h-full w-full object-cover" /> : null}
    </div>
  );
}

function QtyCircleButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-800 disabled:opacity-40"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function OrderQtyStepper({
  qty,
  disabled,
  name,
  onAdd,
  onRemove,
}: {
  qty: number;
  disabled?: boolean;
  name: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t } = useAppTranslation();
  return (
    <div
      className="flex h-6 w-full items-center justify-between gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <QtyCircleButton
        disabled={disabled}
        onClick={onRemove}
        label={t("synckerjaOrder.store.decreaseQty", "Decrease {{name}}", { name })}
      >
        <Minus className="h-3 w-3" strokeWidth={2.5} />
      </QtyCircleButton>
      <span className="min-w-[0.875rem] text-center text-[12px] font-semibold tabular-nums text-neutral-900">
        {qty}
      </span>
      <QtyCircleButton
        disabled={disabled}
        onClick={onAdd}
        label={t("synckerjaOrder.store.increaseQty", "Increase {{name}}", { name })}
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
      </QtyCircleButton>
    </div>
  );
}

function cardBodyOpenProps(canOpen: boolean, onOpen: (() => void) | undefined) {
  if (!canOpen || !onOpen) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onOpen,
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };
}

function cardBodyAction(args: {
  inCart: boolean;
  disabled?: boolean;
  onOpenDetail?: () => void;
  onOpenSheet?: () => void;
}): { canOpen: boolean; onOpen?: () => void } {
  if (args.disabled) return { canOpen: false };
  if (args.inCart && args.onOpenSheet) {
    return { canOpen: true, onOpen: args.onOpenSheet };
  }
  if (!args.inCart && args.onOpenDetail) {
    return { canOpen: true, onOpen: args.onOpenDetail };
  }
  return { canOpen: false };
}

export function OrderFeaturedCard({
  item,
  qty,
  disabled,
  onAdd,
  onRemove,
  onOpenSheet,
  onOpenDetail,
  bleed,
  presentation = "slider",
  className,
  ratingSummary,
}: {
  item: PublicOrderCatalogItem;
  qty: number;
  disabled?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onOpenSheet?: () => void;
  onOpenDetail?: () => void;
  bleed?: boolean;
  presentation?: "slider" | "grid";
  className?: string;
  ratingSummary?: OrderProductRatingSummary | null;
}) {
  const { t } = useAppTranslation();
  const inCart = qty > 0;
  const body = cardBodyAction({ inCart, disabled, onOpenDetail, onOpenSheet });
  const isGrid = presentation === "grid";
  const widthClass = isGrid
    ? "w-full min-w-0"
    : bleed
      ? "w-[calc((100%-1.25rem)/2.25)]"
      : "w-[148px]";
  const layoutClass = isGrid ? "" : "shrink-0 snap-start";
  const radiusClass = isGrid ? "rounded" : "rounded-sm";

  return (
    <div
      className={`flex flex-col overflow-hidden ${radiusClass} bg-white shadow-[0_1px_6px_rgba(0,0,0,0.08)] ${widthClass} ${layoutClass} ${
        body.canOpen ? "cursor-pointer" : ""
      } ${className ?? ""}`}
      {...cardBodyOpenProps(body.canOpen, body.onOpen)}
    >
      <OrderProductPhoto url={item.photo_url} alt={item.name} className="aspect-square w-full" />
      <div className="flex flex-col gap-0.5 px-2 pb-2 pt-1.5">
        <p className="line-clamp-2 text-[11px] font-bold uppercase leading-snug text-neutral-900">
          {item.name}
        </p>
        <OrderProductRatingBadge summary={ratingSummary} className="mt-0" />
        <div className="mt-0.5 flex items-center justify-between gap-2.5">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-none text-neutral-800">
            {formatOrderRp(item.unit_price)}
          </p>
          {inCart ? (
            <div className="w-[72px] shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <OrderQtyStepper
                qty={qty}
                disabled={disabled}
                name={item.name}
                onAdd={onAdd}
                onRemove={onRemove}
              />
            </div>
          ) : (
            <QtyCircleButton
              disabled={disabled}
              onClick={onAdd}
              label={t("synckerjaOrder.store.addItem", "Add {{name}}", { name: item.name })}
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
            </QtyCircleButton>
          )}
        </div>
      </div>
      <div
        className="h-[2px] w-full"
        style={{ backgroundColor: inCart ? ACCENT : "transparent" }}
        aria-hidden
      />
    </div>
  );
}

export function OrderListRow({
  item,
  qty,
  disabled,
  onAdd,
  onRemove,
  onOpenSheet,
  onOpenDetail,
  ratingSummary,
}: {
  item: PublicOrderCatalogItem;
  qty: number;
  disabled?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onOpenSheet?: () => void;
  onOpenDetail?: () => void;
  ratingSummary?: OrderProductRatingSummary | null;
}) {
  const { t } = useAppTranslation();
  const inCart = qty > 0;
  const body = cardBodyAction({ inCart, disabled, onOpenDetail, onOpenSheet });

  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${body.canOpen ? "cursor-pointer" : ""}`}
      {...cardBodyOpenProps(body.canOpen, body.onOpen)}
    >
      <OrderProductPhoto
        url={item.photo_url}
        alt={item.name}
        className="h-16 w-16 shrink-0 rounded"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold uppercase leading-snug text-neutral-900">{item.name}</p>
        <OrderProductRatingBadge summary={ratingSummary} />
        <p className="mt-1 text-[13px] font-medium text-neutral-800">{formatOrderRp(item.unit_price)}</p>
      </div>
      {inCart ? (
        <div
          className="flex w-[76px] shrink-0 items-center justify-between gap-0.5"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <QtyCircleButton
            disabled={disabled}
            onClick={onRemove}
            label={t("synckerjaOrder.store.decreaseQty", "Decrease {{name}}", { name: item.name })}
          >
            <Minus className="h-3 w-3" strokeWidth={2.5} />
          </QtyCircleButton>
          <span className="min-w-[0.875rem] text-center text-[12px] font-semibold tabular-nums">{qty}</span>
          <QtyCircleButton
            disabled={disabled}
            onClick={onAdd}
            label={t("synckerjaOrder.store.increaseQty", "Increase {{name}}", { name: item.name })}
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </QtyCircleButton>
        </div>
      ) : (
        <QtyCircleButton
          disabled={disabled}
          onClick={onAdd}
          label={t("synckerjaOrder.store.addItem", "Add {{name}}", { name: item.name })}
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </QtyCircleButton>
      )}
    </div>
  );
}
