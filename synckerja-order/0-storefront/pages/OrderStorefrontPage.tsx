import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";
import { parseOrderStoreMode } from "@/synckerja-order/shared/lib/orderUrls";
import { isValidPublicCode, normalizePublicCode } from "@/synckerja-order/shared/lib/publicCode";
import { fetchPublicOrderCatalog, fetchPublicOrderStore } from "@/synckerja-order/shared/lib/tenantResolve";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { useOrderCart } from "../lib/useOrderCart";
import {
  completePublicOrderQris,
  createOrderQrisCheckout,
  invokePublicOrderQris,
  pollPublicOrderQris,
  submitOrderPayAtCashier,
} from "../lib/orderCheckoutApi";
import { PhoneShell } from "../components/PhoneShell";
import { OrderStoreHero } from "../components/OrderStoreHero";
import { OrderStoreCatalog } from "../components/OrderStoreCatalog";
import { OrderListRow } from "../components/OrderProductTiles";
import {
  ORDER_CHECKOUT_STACK_BOTTOM,
  OrderFloatingCheckoutBar,
  OrderScrollTopButton,
} from "../components/OrderFloatingCheckoutBar";
import { OrderItemCustomizeOverlay, needsOrderItemCustomize } from "../customize";
import { OrderCartLineSheet, cartLinesForCatalog } from "../cart-sheet";
import {
  OrderPaymentScreen,
  OrderReviewScreen,
  emptyOrderCheckoutPreview,
  ORDER_CHECKOUT_I18N,
  pairingsFromCategories,
  pickRelatedMenuItems,
  prevCheckoutStep,
  resolveOrderFulfillment,
  usePublicOrderCheckoutPreview,
  type OrderCheckoutStep,
  type OrderFulfillment,
  type OrderPaymentKind,
} from "../checkout";
import { nextOrderStorefrontBackLayer } from "../lib/orderStorefrontBack";
import { ORDER_STOREFRONT_INSET_X, ORDER_STOREFRONT_PX } from "../lib/orderStorefrontGutter";
import { useOrderStorefrontBackGuard } from "../lib/useOrderStorefrontBackGuard";
import {
  OrderCashierQrScreen,
  OrderCashierTicketDetailScreen,
  OrderHistoryScreen,
  OrderProfileScreen,
  saveCashierTicket,
  type StoredCashierTicket,
} from "../cashier-ticket";

type CashierTicketView = "qr" | "detail";

export function OrderStorefrontPage() {
  const { t } = useAppTranslation();
  const { language, setLanguage } = useLanguage();
  const { code: rawCode } = useParams<{ code: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const code = normalizePublicCode(rawCode ?? "");
  const mode = parseOrderStoreMode(searchParams.get("mode"));
  const tableNumber = (searchParams.get("tableNumber") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [billNote, setBillNote] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<OrderCheckoutStep | null>(null);
  const [paymentKind, setPaymentKind] = useState<OrderPaymentKind>("online");
  const [qrisSelected, setQrisSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [qris, setQris] = useState<{ qr: string; pendingId: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cashierTicket, setCashierTicket] = useState<StoredCashierTicket | null>(null);
  const [cashierTicketView, setCashierTicketView] = useState<CashierTicketView>("qr");
  const [cashierTicketFromHistory, setCashierTicketFromHistory] = useState(false);
  const [fulfillment, setFulfillment] = useState<OrderFulfillment>("dine_in");
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightId, setHighlightId] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<PublicOrderCatalogItem | null>(null);
  const [sheetCatalogId, setSheetCatalogId] = useState<string | null>(null);
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
  const catalogScrollRef = useRef<HTMLDivElement>(null);
  const consumeCustomizeBackRef = useRef<() => boolean>(() => false);

  const storeQuery = useQuery({
    queryKey: ["public-order-store", code, tableNumber],
    queryFn: () => fetchPublicOrderStore({ code, tableNumber: tableNumber || null }),
    enabled: isValidPublicCode(code),
  });

  const catalogQuery = useQuery({
    queryKey: ["public-order-catalog", code],
    queryFn: () => fetchPublicOrderCatalog(code),
    enabled: isValidPublicCode(code) && mode === "dinein",
  });

  const store = storeQuery.data;
  const catalog = catalogQuery.data;
  const tableFull = store?.ok ? store.table?.join === "full" : false;
  const storeClosed = store?.ok === true && store.is_open === false;
  const orderLocked = tableFull || storeClosed;
  const cart = useOrderCart(orderLocked);

  useEffect(() => {
    if (!highlightId && catalog?.categories[0]?.id) {
      setHighlightId(catalog.categories[0].id);
    }
  }, [catalog, highlightId]);

  const qtyByCatalogId = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart.lines) {
      map.set(line.catalogId, (map.get(line.catalogId) ?? 0) + line.quantity);
    }
    return map;
  }, [cart.lines]);

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return catalog?.items ?? [];
    return (catalog?.items ?? []).filter((item) => item.name.toLowerCase().includes(q));
  }, [catalog?.items, searchQuery]);

  const relatedItems = useMemo(
    () =>
      pickRelatedMenuItems({
        lines: cart.lines,
        items: catalog?.items ?? [],
        pairings: pairingsFromCategories(catalog?.categories ?? []),
        limit: 8,
      }),
    [cart.lines, catalog],
  );

  const checkoutPreviewQuery = usePublicOrderCheckoutPreview({
    code,
    subtotal: cart.subtotal,
    enabled: Boolean(checkoutStep) && cart.subtotal > 0,
  });
  const checkoutPreview = checkoutPreviewQuery.data ?? emptyOrderCheckoutPreview(cart.subtotal);

  useEffect(() => {
    if (!qris) return;
    const timer = window.setInterval(() => {
      void (async () => {
        const status = await pollPublicOrderQris({ code, pendingCheckoutId: qris.pendingId });
        if (status.status === "paid" || status.sales_activity_id) {
          await completePublicOrderQris({ code, pendingCheckoutId: qris.pendingId });
          setQris(null);
          setCheckoutStep(null);
          cart.clear();
          setMessage(t("synckerjaOrder.store.paid", "Payment received. Thank you."));
        }
      })();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [qris, code, t]);

  useEffect(() => {
    if (orderLocked) {
      setCheckoutStep(null);
      setQris(null);
      setSheetCatalogId(null);
      setCustomizeItem(null);
      setEditingLineKey(null);
    }
  }, [orderLocked]);

  useEffect(() => {
    if (checkoutStep === "review" && cart.itemCount === 0) {
      setCheckoutStep(null);
    }
  }, [checkoutStep, cart.itemCount]);

  useEffect(() => {
    if (!sheetCatalogId) return;
    if (!cart.lines.some((line) => line.catalogId === sheetCatalogId)) {
      setSheetCatalogId(null);
    }
  }, [cart.lines, sheetCatalogId]);

  const setCategoryParam = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("category", id);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  useOrderStorefrontBackGuard({
    enabled: isValidPublicCode(code) && mode !== "pickup" && store?.ok === true,
    onBack: () => {
      if (consumeCustomizeBackRef.current()) return;
      const layer = nextOrderStorefrontBackLayer({
        lightbox: false,
        customize: Boolean(customizeItem),
        cartSheet: Boolean(sheetCatalogId),
        cashierQr: Boolean(cashierTicket && cashierTicketView === "qr"),
        ticketDetail: Boolean(cashierTicket && cashierTicketView === "detail"),
        orderHistory: historyOpen,
        profile: profileOpen,
        checkoutQris: Boolean(qris),
        paymentMethod: checkoutStep === "payment",
        customerInfo: false,
        orderReview: checkoutStep === "review",
        search: searchOpen,
        menu: menuOpen,
        category: Boolean(category),
      });
      if (layer === "customize") {
        setCustomizeItem(null);
        setEditingLineKey(null);
        return;
      }
      if (layer === "cartSheet") {
        setSheetCatalogId(null);
        return;
      }
      if (layer === "cashierQr") {
        if (cashierTicketFromHistory) {
          setCashierTicketView("detail");
        } else {
          setCashierTicket(null);
        }
        return;
      }
      if (layer === "ticketDetail") {
        setCashierTicket(null);
        if (cashierTicketFromHistory) {
          setCashierTicketFromHistory(false);
          setHistoryOpen(true);
          setProfileOpen(true);
        }
        return;
      }
      if (layer === "orderHistory") {
        setHistoryOpen(false);
        return;
      }
      if (layer === "profile") {
        setProfileOpen(false);
        return;
      }
      if (layer === "checkoutQris") {
        setQris(null);
        return;
      }
      if (layer === "paymentMethod") {
        setCheckoutStep("review");
        setQris(null);
        return;
      }
      if (layer === "orderReview") {
        setCheckoutStep(null);
        return;
      }
      if (layer === "search") {
        setSearchOpen(false);
        return;
      }
      if (layer === "menu") {
        setMenuOpen(false);
        return;
      }
      if (layer === "category") {
        setCategoryParam(null);
      }
    },
  });

  if (!isValidPublicCode(code)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 text-sm text-muted-foreground">
        {t("synckerjaOrder.store.invalidCode", "This store link is not valid.")}
      </div>
    );
  }

  if (mode === "pickup") {
    return (
      <PhoneShell>
        <div className={`flex flex-1 items-center justify-center ${ORDER_STOREFRONT_PX} py-8 text-center text-sm text-muted-foreground`}>
          {t(SYNCKERJA_ORDER_I18N.pickupSoon, "Pickup ordering is coming soon.")}
        </div>
      </PhoneShell>
    );
  }

  if (storeQuery.isLoading) {
    return (
      <PhoneShell>
        <div className={`${ORDER_STOREFRONT_PX} py-6 text-sm text-muted-foreground`}>…</div>
      </PhoneShell>
    );
  }

  if (!store?.ok) {
    return (
      <PhoneShell>
        <div className={`${ORDER_STOREFRONT_PX} py-6 text-sm text-muted-foreground`}>
          {t("synckerjaOrder.store.notFound", "Store not found.")}
        </div>
      </PhoneShell>
    );
  }

  const storeName = store.business_name || store.outlet_name || "";
  const isOpen = store.is_open !== false;
  const allowTakeAway = store.pickup_enabled === true;
  const effectiveFulfillment = resolveOrderFulfillment({
    pickupEnabled: allowTakeAway,
    selected: fulfillment,
  });

  const checkoutErrorMessage = (error: string | undefined, fallback: string) => {
    if (error === "table_full") {
      return t(SYNCKERJA_ORDER_I18N.tableFull, "This table is full. Please call staff.");
    }
    if (error === "store_closed") {
      return t(SYNCKERJA_ORDER_I18N.storeClosed, "Store is closed.");
    }
    if (error === "fulfillment_mismatch") {
      return t(
        ORDER_CHECKOUT_I18N.fulfillmentMismatch,
        "Finish or cancel your current cashier ticket before changing order type.",
      );
    }
    if (error === "pos_checkout_phone_exists" || error?.includes("pos_checkout_phone_exists")) {
      return t(
        "synckerjaOrder.store.phoneExists",
        "This phone number is already registered. Continue without phone or use a different number.",
      );
    }
    return error || fallback;
  };

  const onAdd = (item: PublicOrderCatalogItem) => {
    if (orderLocked) return;
    const alreadyInCart = (qtyByCatalogId.get(item.id) ?? 0) > 0;
    if (alreadyInCart) {
      // Catalog +/- only opens the cart drawer; qty changes happen inside the drawer.
      setSheetCatalogId(item.id);
      setCustomizeItem(null);
      setEditingLineKey(null);
      return;
    }
    if (needsOrderItemCustomize(item)) {
      setEditingLineKey(null);
      setCustomizeItem(item);
      return;
    }
    cart.add(item, item.variants[0]);
  };

  const onRemove = (item: PublicOrderCatalogItem) => {
    if (orderLocked) return;
    if ((qtyByCatalogId.get(item.id) ?? 0) <= 0) return;
    // Catalog minus only opens the drawer — do not remove lines here.
    setSheetCatalogId(item.id);
  };

  const onOpenSheet = (item: PublicOrderCatalogItem) => {
    if (orderLocked) return;
    if ((qtyByCatalogId.get(item.id) ?? 0) <= 0) return;
    setSheetCatalogId(item.id);
  };

  const onOpenDetail = (item: PublicOrderCatalogItem) => {
    if (orderLocked) return;
    setEditingLineKey(null);
    setCustomizeItem(item);
  };

  const onPayAtCashier = async () => {
    if (orderLocked || !tableNumber || cart.lines.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await submitOrderPayAtCashier({
        code,
        tableNumber,
        guestName,
        guestPhone,
        guestEmail,
        billNote,
        lines: cart.lines,
        fulfillment: effectiveFulfillment,
      });
      if (!res.ok || !res.claim_token || !res.pending_checkout_id || !res.session_id) {
        setMessage(
          checkoutErrorMessage(
            res.error,
            t("synckerjaOrder.store.submitError", "Could not create cashier ticket."),
          ),
        );
        return;
      }
      const ticket: StoredCashierTicket = {
        id: res.pending_checkout_id,
        storeCode: code,
        claimToken: res.claim_token,
        pendingCheckoutId: res.pending_checkout_id,
        sessionId: res.session_id,
        tableNumber,
        storeName: storeName,
        grandTotal: res.grand_total ?? checkoutPreview.grandTotal,
        createdAt: new Date().toISOString(),
        expiresAt: res.expires_at ?? new Date(Date.now() + 4 * 3600000).toISOString(),
        status: "pending",
        fulfillment: res.fulfillment ?? effectiveFulfillment,
      };
      saveCashierTicket(ticket);
      cart.clear();
      setCheckoutStep(null);
      setQris(null);
      setCashierTicket(ticket);
      setCashierTicketView("qr");
      setCashierTicketFromHistory(false);
      setMessage(null);
    } catch (err) {
      console.error("onPayAtCashier failed", err);
      setMessage(
        t("synckerjaOrder.store.submitError", "Could not create cashier ticket."),
      );
    } finally {
      setBusy(false);
    }
  };

  const onPayQris = async () => {
    if (orderLocked || !tableNumber || cart.lines.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const pending = await createOrderQrisCheckout({
        code,
        tableNumber,
        guestName,
        guestPhone,
        guestEmail,
        billNote,
        lines: cart.lines,
        fulfillment: effectiveFulfillment,
      });
      if (!pending.ok || !pending.pending_checkout_id) {
        setMessage(
          checkoutErrorMessage(
            pending.error,
            t("synckerjaOrder.store.submitError", "Could not start QRIS."),
          ),
        );
        return;
      }
      const created = await invokePublicOrderQris({
        code,
        pendingCheckoutId: pending.pending_checkout_id,
      });
      const qr = created.payment_request?.qr_string;
      if (!created.ok || !qr) {
        setMessage(created.error || t("synckerjaOrder.store.submitError", "Could not start QRIS."));
        return;
      }
      setQris({ qr, pendingId: pending.pending_checkout_id });
    } finally {
      setBusy(false);
    }
  };

  const sheetItem = sheetCatalogId
    ? (catalog?.items.find((item) => item.id === sheetCatalogId) ?? null)
    : null;
  const sheetLines = sheetItem ? cartLinesForCatalog(cart.lines, sheetItem.id) : [];
  const editingLine =
    editingLineKey && customizeItem
      ? (cart.lines.find((line) => line.lineKey === editingLineKey) ?? null)
      : null;
  const overlayOpen = Boolean(customizeItem);
  const sheetOpen = Boolean(sheetItem && sheetLines.length > 0);
  const checkoutOpen = Boolean(checkoutStep);
  const profileOverlayOpen = profileOpen || historyOpen || Boolean(cashierTicket);
  const closeCheckoutLayer = () => {
    const prev = prevCheckoutStep(checkoutStep);
    setQris(null);
    setCheckoutStep(prev);
  };

  return (
    <PhoneShell>
      <div
        ref={catalogScrollRef}
        className={`scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          overlayOpen || sheetOpen || checkoutOpen || profileOverlayOpen
            ? "overflow-hidden"
            : "overflow-y-auto overflow-x-hidden"
        }`}
        onScroll={(e) => {
          setShowScrollTop(e.currentTarget.scrollTop > 240);
        }}
      >
        <OrderStoreHero
          coverUrl={store.cover_url}
          storeName={storeName}
          isOpen={isOpen}
          hours={store.hours}
          onSearch={() => setSearchOpen(true)}
          onMenu={() => setProfileOpen(true)}
          onStoreInfo={() => setProfileOpen(true)}
        />

        {tableNumber ? (
          <div className="mx-2.5 mt-2 rounded-lg bg-[#F3D5C2] py-2.5 text-center text-[13px] font-medium text-neutral-800">
            {t("synckerjaOrder.store.tableNumber", "Table Number: {{name}}", { name: tableNumber })}
          </div>
        ) : null}

        {tableFull ? (
          <div className="mx-2.5 mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            {t(SYNCKERJA_ORDER_I18N.tableFull, "This table is full. Please call staff.")}
          </div>
        ) : null}

        {storeClosed ? (
          <div className="mx-2.5 mt-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
            {t("synckerjaOrder.store.closed", "This store is closed. You cannot add items or place an order.")}
          </div>
        ) : null}

        <OrderStoreCatalog
          categories={catalog?.categories ?? []}
          items={catalog?.items ?? []}
          filterCategoryId={category}
          highlightId={highlightId}
          qtyByCatalogId={qtyByCatalogId}
          tableFull={orderLocked}
          scrollRootRef={catalogScrollRef}
          onHighlight={(id) => {
            setHighlightId(id);
            if (category) setCategoryParam(null);
          }}
          onViewAll={(id) => {
            setHighlightId(id);
            setCategoryParam(id);
          }}
          onAdd={onAdd}
          onRemove={onRemove}
          onOpenSheet={onOpenSheet}
          onOpenDetail={onOpenDetail}
          bottomPad={cart.itemCount > 0}
        />
      </div>

      {message ? (
        <div className={`absolute ${ORDER_STOREFRONT_INSET_X} z-50 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 ${ORDER_CHECKOUT_STACK_BOTTOM}`}>
          {message}
        </div>
      ) : null}

      {!checkoutOpen && !orderLocked && !overlayOpen && !sheetOpen ? (
        <>
          <OrderScrollTopButton
            visible={showScrollTop}
            onClick={() => {
              catalogScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <OrderFloatingCheckoutBar
            itemCount={cart.itemCount}
            total={cart.subtotal}
            onCheckout={() => {
              setMessage(null);
              setCheckoutStep("review");
            }}
          />
        </>
      ) : null}

      {searchOpen ? (
        <div className="absolute inset-0 z-30 flex flex-col bg-white">
          <div className={`flex items-center gap-2 border-b ${ORDER_STOREFRONT_PX} py-3`}>
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("synckerjaOrder.store.searchPlaceholder", "Search menu")}
            />
            <button type="button" className="p-2 text-neutral-500" onClick={() => setSearchOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className={`scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${ORDER_STOREFRONT_PX}`}
          >
            {searchHits.map((item) => (
              <OrderListRow
                key={item.id}
                item={item}
                qty={qtyByCatalogId.get(item.id) ?? 0}
                disabled={orderLocked}
                onAdd={() => onAdd(item)}
                onRemove={() => onRemove(item)}
                onOpenSheet={() => onOpenSheet(item)}
                onOpenDetail={() => onOpenDetail(item)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="absolute inset-0 z-30 flex items-end bg-black/40 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className={`w-full rounded-t-2xl bg-white ${ORDER_STOREFRONT_PX} py-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">{storeName}</h2>
              <button type="button" onClick={() => setMenuOpen(false)}>
                <X className="h-5 w-5 text-neutral-500" />
              </button>
            </div>
            <p className="text-sm text-neutral-600">{store.outlet_name}</p>
            <button
              type="button"
              className="mt-4 w-full text-sm text-muted-foreground"
              onClick={() => setMenuOpen(false)}
            >
              {t("synckerjaOrder.store.close", "Close")}
            </button>
          </div>
        </div>
      ) : null}

      {sheetOpen && sheetItem ? (
        <OrderCartLineSheet
          item={sheetItem}
          lines={sheetLines}
          canCustomize={needsOrderItemCustomize(sheetItem)}
          disabled={orderLocked}
          onClose={() => setSheetCatalogId(null)}
          onEdit={(line) => {
            if (orderLocked) return;
            setEditingLineKey(line.lineKey);
            setCustomizeItem(sheetItem);
          }}
          onMakeAnother={() => {
            if (orderLocked) return;
            // Always open detail (notes / options) for a new line — do not bump qty.
            setEditingLineKey(null);
            setCustomizeItem(sheetItem);
          }}
          onSetQty={(lineKey, quantity) => {
            if (orderLocked) return;
            cart.setQty(lineKey, quantity);
          }}
        />
      ) : null}

      {customizeItem ? (
        <OrderItemCustomizeOverlay
          key={`${customizeItem.id}:${editingLineKey ?? "new"}`}
          code={code}
          item={customizeItem}
          locked={orderLocked}
          initialLine={editingLine}
          consumeBackRef={consumeCustomizeBackRef}
          onClose={() => {
            setCustomizeItem(null);
            setEditingLineKey(null);
          }}
          onConfirm={(line) => {
            if (editingLineKey) cart.replaceLine(editingLineKey, line);
            else cart.addCustomizedLine(line);
          }}
        />
      ) : null}

      {checkoutStep === "review" && !orderLocked ? (
        <OrderReviewScreen
          code={code}
          lines={cart.lines}
          relatedItems={relatedItems}
          qtyByCatalogId={qtyByCatalogId}
          billNote={billNote}
          preview={checkoutPreview}
          fulfillment={effectiveFulfillment}
          allowTakeAway={allowTakeAway}
          disabled={busy}
          onBack={() => setCheckoutStep(null)}
          onAddItem={() => setCheckoutStep(null)}
          onBillNoteChange={setBillNote}
          onFulfillmentChange={setFulfillment}
          onContinue={() => setCheckoutStep("payment")}
          onAddRelated={onAdd}
          onRemoveRelated={onRemove}
          onOpenRelatedSheet={onOpenSheet}
          onOpenRelatedDetail={onOpenDetail}
          onEditLine={(line) => {
            const item = catalog?.items.find((row) => row.id === line.catalogId);
            if (!item) return;
            setEditingLineKey(line.lineKey);
            setCustomizeItem(item);
          }}
          onSetQty={(lineKey, quantity) => cart.setQty(lineKey, quantity)}
        />
      ) : null}

      {checkoutStep === "payment" && !orderLocked ? (
        <OrderPaymentScreen
          guestName={guestName}
          guestPhone={guestPhone}
          guestEmail={guestEmail}
          tableNumber={tableNumber}
          storeName={storeName}
          fulfillment={effectiveFulfillment}
          kind={paymentKind}
          qrisSelected={qrisSelected}
          qrisCode={qris?.qr ?? null}
          total={checkoutPreview.grandTotal}
          busy={busy}
          onBack={closeCheckoutLayer}
          onGuestNameChange={setGuestName}
          onGuestPhoneChange={setGuestPhone}
          onGuestEmailChange={setGuestEmail}
          onKindChange={(kind) => {
            setPaymentKind(kind);
            if (kind === "cashier") setQrisSelected(false);
          }}
          onQrisSelectedChange={setQrisSelected}
          onPayOnline={() => void onPayQris()}
          onPayCashier={() => void onPayAtCashier()}
        />
      ) : null}

      {profileOpen && !historyOpen && !cashierTicket ? (
        <OrderProfileScreen
          onBack={() => setProfileOpen(false)}
          onOrderHistory={() => setHistoryOpen(true)}
          onLanguage={() => setLanguage(language === "id" ? "en" : "id")}
          languageLabel={language === "id" ? "Bahasa Indonesia" : "English"}
        />
      ) : null}

      {historyOpen ? (
        <OrderHistoryScreen
          storeCode={code}
          onBack={() => {
            setHistoryOpen(false);
            if (!profileOpen) setProfileOpen(true);
          }}
          onOpenTicket={(ticket) => {
            setCashierTicket(ticket);
            setCashierTicketView("detail");
            setCashierTicketFromHistory(true);
            setHistoryOpen(false);
          }}
        />
      ) : null}

      {cashierTicket && cashierTicketView === "detail" ? (
        <OrderCashierTicketDetailScreen
          code={code}
          ticket={cashierTicket}
          onBack={() => {
            setCashierTicket(null);
            setCashierTicketFromHistory(false);
            setHistoryOpen(true);
            setProfileOpen(true);
          }}
          onShowQr={() => setCashierTicketView("qr")}
        />
      ) : null}

      {cashierTicket && cashierTicketView === "qr" ? (
        <OrderCashierQrScreen
          code={code}
          claimToken={cashierTicket.claimToken}
          storeName={cashierTicket.storeName || storeName}
          tableNumber={cashierTicket.tableNumber}
          grandTotal={cashierTicket.grandTotal}
          expiresAt={cashierTicket.expiresAt}
          fulfillment={cashierTicket.fulfillment}
          onBack={() => {
            if (cashierTicketFromHistory) {
              setCashierTicketView("detail");
              return;
            }
            setCashierTicket(null);
          }}
          onReturnToMenu={() => {
            setCashierTicket(null);
            setCashierTicketFromHistory(false);
            setProfileOpen(false);
            setHistoryOpen(false);
          }}
        />
      ) : null}
    </PhoneShell>
  );
}
