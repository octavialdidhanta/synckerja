import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isCatalogProductHidden } from "@/8-2-1-default-prices/lib/catalogKind";
import { useCustomerVisitCart } from "@/5-2-customer-visits/checkout/hooks/useCustomerVisitCart";
import { useCustomerVisitCatalog } from "@/5-2-customer-visits/checkout/hooks/useCustomerVisitCatalog";
import { useStoreCheckoutPricing } from "@/5-2-customer-visits/checkout/hooks/useStoreCheckoutPricing";
import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
  stashPosSelectedOutlet,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import {
  clearPosSelectedTable,
  readPosSelectedTable,
  stashPosSelectedTable,
  type PosSelectedTable,
} from "@/pos-mobile/5-table-map/lib/posSelectedTableStorage";
import { formatPosTableDuration } from "@/pos-mobile/5-table-map/lib/formatPosTableDuration";
import { usePosTableSessionMutations, POS_TABLE_SESSIONS_QUERY_KEY } from "@/8-2-9-table-management/hooks/usePosTableSessions";
import {
  POS_CASHIER_SHIFTS_QUERY_KEY,
  POS_CASH_MOVEMENTS_QUERY_KEY,
  usePosOpenShift,
} from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import { POS_SHIFT_I18N } from "@/pos-mobile/4-shift/lib/posShiftCopy";
import { lookupPosCheckoutLeadByPhone } from "@/5-2-customer-visits/checkout/pos-bind";
import { PosAddCustomerDialog } from "../components/add-customer";
import { PosCashierBillPanel } from "../components/PosCashierBillPanel";
import {
  posCashierCustomerBillLabel,
  posCashierCustomerFromLoyalty,
  posLoyaltyIdentityFromCashier,
  type PosCashierCustomer,
} from "../lib/posCashierCustomer";
import { hydratePosBillCustomer } from "../lib/hydratePosBillCustomer";
import { loyaltySkipResult } from "../lib/posLoyaltyIdentity";
import { PosBillListDialog, PosBillReasonDialog } from "../components/bill-list";
import {
  PosSelectTableOverlay,
  type PosSelectTablePick,
} from "../components/select-table";
import { PosNewBillDialog } from "../components/new-bill";
import { PosSplitBillDialog } from "../components/split-bill";
import { PosLoyaltyDialog, type PosLoyaltyResult } from "../components/loyalty";
import {
  PosPaymentMethodDialog,
  type PosPaymentConfirmPayload,
} from "../components/payment";
import { PosQrisPaymentDialog } from "../payment/qris";
import { preparePosQrisCheckout } from "../payment/qris/lib/preparePosQrisCheckout";
import { usePosQrisEligibility } from "@/shared/pos-qris";
import { markLeadConvertedIfNeeded } from "@/5-2-customer-visits/checkout/lib/createStoreCheckoutSalesActivity";
import { recordPosPaidCustomerVisit } from "@/5-2-customer-visits/checkout/pos-bind";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import type { BuildPendingCheckoutPayloadArgs } from "@/shared/pos-qris/lib/buildPendingCheckoutPayload";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import {
  PosPaySuccessScreen,
  type PosPaySuccessPayload,
} from "../components/pay-success";
import { buildFullCartSelection, splitCartLinesByQty } from "../lib/splitCartLines";
import { applyPosRewardToTotal } from "../hooks/usePosOutletRewards";
import { sendPosDigitalReceipt } from "../lib/sendPosDigitalReceipt";
import { POS_PAY_SUCCESS_I18N } from "../lib/posPaySuccessCopy";
import {
  assignPayFirstTable,
  paySuccessTablePickState,
  shouldKeepPayFirstSessionOpen,
} from "../lib/pay-first-seating";
import { POS_KITCHEN_TICKETS_QUERY_KEY } from "@/pos-mobile/8-kitchen/lib/posKitchenTypes";
import { usePosShiftWaiterCandidate } from "../hooks/usePosShiftWaiterCandidate";
import { POS_SELECT_TABLE_I18N } from "../lib/posSelectTableCopy";
import { POS_NEW_BILL_I18N } from "../lib/posNewBillCopy";
import {
  usePosBillListCancelledSessions,
  usePosBillListOpenSessions,
  usePosBillListPaidSessions,
  type PosBillListRow,
} from "../hooks/usePosBillListSessions";
import { usePosCheckoutRefund } from "../hooks/usePosCheckoutRefund";
import { usePosLineVoids } from "../hooks/usePosLineVoids";
import { POS_BILL_LIST_I18N, type PosBillListTab } from "../lib/posBillListCopy";
import {
  catalogItemLabel,
  isCatalogItemOutOfStock,
} from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type {
  CustomerVisitCartLine,
  CustomerVisitCatalogItem,
} from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { PosCashierBottomNav, type PosCashierTab } from "../components/PosCashierBottomNav";
import { PosCashierMenuDrawer } from "../components/PosCashierMenuDrawer";
import { PosFavoritesGrid } from "../components/PosFavoritesGrid";
import { PosFavoritesEditPanel } from "../components/PosFavoritesEditPanel";
import { PosAddFavoriteDialog } from "../components/PosAddFavoriteDialog";
import {
  PosLibraryHome,
  PosLibraryProductPane,
  PosLibrarySoonPane,
} from "../components/library";
import { PosCustomKeypad } from "../components/custom";
import { PosItemCustomizeDialog } from "../components/customize";
import { needsItemCustomize } from "../lib/needsItemCustomize";
import { usePosCashierPay } from "../hooks/usePosCashierPay";
import { usePosFulfillmentStockCommit } from "../hooks/usePosFulfillmentStockCommit";
import { usePosOutletStockSettings } from "@/stock-management/stock-commit/hooks/usePosOutletStockSettings";
import { resolvePosPayFailureToast } from "@/stock-management/catalog-ledger/lib/checkoutStockToast";
import { resolveCheckoutStockToast } from "@/stock-management/catalog-ledger/lib/checkoutStockToast";
import { reverseKitchenStockForVoid } from "@/stock-management/stock-commit/lib/stockCommitOrchestrator";
import {
  applyKitchenTicketLineVoid,
} from "@/pos-mobile/8-kitchen/lib/createPosKitchenTickets";
import { fireKitchenForCheckout } from "@/pos-mobile/8-kitchen/lib/fireKitchenForCheckout";
import {
  claimSynckerjaCashierCheckout,
  claimedCashierToBillSession,
  completeSynckerjaCashierCheckout,
  markSynckerjaCashierKitchenFired,
  resolveCashierQrClaimErrorMessage,
} from "../lib/claimSynckerjaCashierCheckout";
import { usePosCashierQrScan } from "../hooks/usePosCashierQrScan";
import { shouldAutoDoneKitchenOnPay } from "@/pos-mobile/8-kitchen/lib/shouldAutoDoneKitchenOnPay";
import {
  applyKitchenAutoDoneOnPay,
  buildKitchenPayCheckoutContext,
  runKitchenFireOnPay,
  toastKitchenFireResult,
  type KitchenPayCheckoutContext,
} from "../lib/kitchenCheckoutContext";
import { cartLineFingerprint } from "../lib/cartLineFingerprint";
import { POS_STOCK_COMMIT_I18N } from "../lib/posStockCommitCopy";
import { usePosOutletFavorites } from "../hooks/usePosOutletFavorites";
import { usePosLibraryCategoryOrder } from "../hooks/usePosLibraryCategoryOrder";
import { usePosOutletBundles } from "../hooks/usePosOutletBundles";
import { usePosProductRecipeStock } from "../hooks/usePosProductRecipeStock";
import {
  mapPosBundleToCatalogItem,
  resolvePosBundleUnitPrice,
} from "../lib/bundles";
import { buildPosLibrarySections } from "../lib/buildPosLibrarySections";
import type { PosLibrarySection } from "../lib/posLibrarySections";
import {
  createCustomCartLine,
  mergePosCheckoutTotalsWithCustom,
  splitPosCartLines,
} from "../lib/posCustomAmount";
import { payPosCustomCashIns } from "../lib/payPosCustomCashIns";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";
import { recipeOutOfStockLabel } from "../lib/recipeOutOfStockLabel";
import { POS_SETTINGS_I18N } from "@/pos-mobile/3-settings/lib/posSettingsCopy";
import {
  getPosTicketPrintPrefs,
  printPosReceiptBill,
} from "@/pos-mobile/shared/printing/posPrintService";
import { PosPrinterUnavailableError } from "@/pos-mobile/shared/printing/PosPrinterBridge";
import { usePosPinGate } from "@/pos-mobile/shared/hooks/usePosPinGate";
import { POS_PIN_FEATURES } from "@/pos-mobile/shared/lib/posPinFeatures";

/**
 * Synckerja POS cashier — tablet shell after outlet select.
 * Authenticated route: `/pos/cashier` (outside AdaptiveAppLayout).
 */
export default function PosCashierPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const permissions = usePosAppPermissions();

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const { rows: outletRows } = usePosOutlets();
  const outletRow = useMemo(
    () => (outletId ? outletRows.find((row) => row.id === outletId) ?? null : null),
    [outletId, outletRows],
  );
  const outletName = outletMeta?.name || outletRow?.name || outletId || "";
  const outletAddress =
    outletMeta?.address?.trim() || outletRow?.address?.trim() || null;

  useEffect(() => {
    if (!outletId || !outletRow) return;
    const name = outletMeta?.name || outletRow.name;
    const address = outletRow.address?.trim() || null;
    if (!outletMeta?.address && address) {
      stashPosSelectedOutlet({ id: outletId, name, address });
    }
  }, [outletId, outletRow, outletMeta?.address, outletMeta?.name]);

  const { runWithPin, pinDialog } = usePosPinGate(outletId);

  const catalog = useCustomerVisitCatalog(outletId);
  const cart = useCustomerVisitCart();
  const [salesTypeId, setSalesTypeId] = useState("");
  const pricing = useStoreCheckoutPricing(outletId, salesTypeId || null);
  const checkoutTotals = useMemo(() => {
    const { catalogLines, customTotal } = splitPosCartLines(cart.lines);
    const priced = pricing.compute(catalogLines);
    return mergePosCheckoutTotalsWithCustom(priced, customTotal);
  }, [pricing, cart.lines]);
  const pay = usePosCashierPay();
  const { isSandbox: qrisSandbox } = usePosQrisEligibility(outletId);
  const fulfillStock = usePosFulfillmentStockCommit();
  const { stockCommitPoint } = usePosOutletStockSettings(outletId);
  const sessionMutations = usePosTableSessionMutations(outletId);
  const favorites = usePosOutletFavorites(outletId);
  const libraryCategories = usePosLibraryCategoryOrder(outletId);
  const outletBundles = usePosOutletBundles(outletId);
  const { recipeOutOfStockIds, recipeOutOfStockReasons } = usePosProductRecipeStock(outletId);

  const [tab, setTab] = useState<PosCashierTab>("favorit");
  const [pageIndex, setPageIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [favoritesEditing, setFavoritesEditing] = useState(false);
  const [addFavoriteOpen, setAddFavoriteOpen] = useState(false);
  const [libraryEditing, setLibraryEditing] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryView, setLibraryView] = useState<
    | "home"
    | { type: "products"; sectionId: string; title: string }
    | { type: "bundles"; title: string }
    | { type: "soon"; title: string }
  >("home");
  const [customer, setCustomer] = useState<PosCashierCustomer | null>(null);
  const guestHydrateGen = useRef(0);
  const lastHydratedSessionId = useRef<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<PosSelectedTable | null>(() => {
    const stored = readPosSelectedTable();
    if (!stored) return null;
    if (outletId && stored.outletId !== outletId) {
      clearPosSelectedTable();
      return null;
    }
    return stored;
  });
  const [durationTick, setDurationTick] = useState(() => Date.now());
  const [cartRestored, setCartRestored] = useState(false);
  const [billListOpen, setBillListOpen] = useState(false);
  const [billListTab, setBillListTab] = useState<PosBillListTab>("open");
  const [cancelTarget, setCancelTarget] = useState<PosBillListRow | null>(null);
  const [pendingVoid, setPendingVoid] = useState<{
    lineKey: string;
    catalogId: string;
    nextQty: number;
    line: CustomerVisitCartLine;
    voidQty: number;
  } | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [selectTableOpen, setSelectTableOpen] = useState(false);
  const [newBillPick, setNewBillPick] = useState<PosSelectTablePick | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [splitBillOpen, setSplitBillOpen] = useState(false);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"split" | "full" | null>(null);
  const [splitSelection, setSplitSelection] = useState<Map<string, number> | null>(null);
  const [loyaltyResult, setLoyaltyResult] = useState<PosLoyaltyResult>({
    customer: null,
    reward: null,
  });
  const [portionPayBusy, setPortionPayBusy] = useState(false);
  const [paySuccess, setPaySuccess] = useState<PosPaySuccessPayload | null>(null);
  const [pickTableAfterPayOpen, setPickTableAfterPayOpen] = useState(false);
  const [assignTableBusy, setAssignTableBusy] = useState(false);
  const [qrisOpen, setQrisOpen] = useState(false);
  const [qrisFlow, setQrisFlow] = useState<{
    checkout: BuildPendingCheckoutPayloadArgs;
    leadId: string;
    boundByPhone: boolean;
    clientPhone: string | null;
    amountDue: number;
    splitLines: CustomerVisitCartLine[];
    paidCatalogTotals: CatalogCheckoutTotals;
    customTotal: number;
    clientName: string;
    catalogLines: CustomerVisitCartLine[];
    keepOpen: boolean;
    remainderLines: CustomerVisitCartLine[];
    kitchenCheckout: KitchenPayCheckoutContext;
    paySessionId: string | null;
    posTableId: string | null;
    servedByUserId: string | null;
  } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [customizeItem, setCustomizeItem] = useState<CustomerVisitCatalogItem | null>(
    null,
  );
  const [activeOpenSessionId, setActiveOpenSessionId] = useState<string | null>(() => {
    const stored = readPosSelectedTable();
    return stored?.sessionId ?? null;
  });
  const [synckerjaCashierCheckout, setSynckerjaCashierCheckout] = useState<{
    pendingCheckoutId: string;
    kitchenFired: boolean;
  } | null>(null);
  const claimScanBusyRef = useRef(false);

  const markSynckerjaKitchenIfNeeded = async () => {
    if (!outletId || !synckerjaCashierCheckout || synckerjaCashierCheckout.kitchenFired) {
      return;
    }
    await markSynckerjaCashierKitchenFired({
      pendingCheckoutId: synckerjaCashierCheckout.pendingCheckoutId,
      outletId,
    });
    setSynckerjaCashierCheckout((prev) => (prev ? { ...prev, kitchenFired: true } : prev));
  };

  const paySuccessCheckoutChannel = synckerjaCashierCheckout
    ? ("synckerja_cashier" as const)
    : undefined;

  const shiftWaiter = usePosShiftWaiterCandidate(outletId);

  const billListOpenSessions = usePosBillListOpenSessions(outletId);
  const billListCancelled = usePosBillListCancelledSessions(outletId);
  const billListPaid = usePosBillListPaidSessions(outletId);

  const resolveServedByUserId = (sessionId: string | null | undefined): string | null => {
    if (!sessionId) return null;
    const row = billListOpenSessions.rows.find((r) => r.session.id === sessionId);
    if (!row) return null;
    return row.session.waiter_id || row.session.opened_by || null;
  };
  const checkoutRefund = usePosCheckoutRefund();
  const openShiftQuery = usePosOpenShift(outletId);
  const lineVoids = usePosLineVoids(outletId);

  useEffect(() => {
    if (!selectedTable?.seatedAt && !selectedTable?.sessionId) return;
    const id = window.setInterval(() => setDurationTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [selectedTable?.seatedAt, selectedTable?.sessionId]);

  useEffect(() => {
    if (cartRestored) return;
    const snap = selectedTable?.cartSnapshot;
    if (!snap || snap.length === 0) {
      setCartRestored(true);
      return;
    }
    cart.replaceLines(snap);
    setCartRestored(true);
    stashPosSelectedTable({ ...selectedTable!, cartSnapshot: null });
  }, [cart, cartRestored, selectedTable]);

  // Walk-in resume from table-map bill list: keep session + cart, clear fake table badge.
  useEffect(() => {
    if (!cartRestored) return;
    if (!selectedTable || selectedTable.id) return;
    if (!selectedTable.sessionId) return;
    clearPosSelectedTable();
    setSelectedTable(null);
  }, [cartRestored, selectedTable]);

  const applySessionGuest = (
    sessionId: string,
    guestName: string,
    guestPhone: string,
  ) => {
    const gen = ++guestHydrateGen.current;
    lastHydratedSessionId.current = sessionId;
    setCustomer(
      hydratePosBillCustomer({
        sessionName: guestName,
        sessionPhone: guestPhone,
        lead: null,
      }),
    );
    if (!guestPhone.trim() || !organizationId) return;
    void lookupPosCheckoutLeadByPhone({
      organizationId,
      rawPhone: guestPhone,
    })
      .then((found) => {
        if (guestHydrateGen.current !== gen) return;
        setCustomer(
          hydratePosBillCustomer({
            sessionName: guestName,
            sessionPhone: guestPhone,
            lead: found?.lead ?? null,
          }),
        );
      })
      .catch(() => {
        /* keep session text */
      });
  };

  const persistBillCustomer = (next: PosCashierCustomer | null) => {
    guestHydrateGen.current += 1;
    setCustomer(next);
    const sid = selectedTable?.sessionId ?? activeOpenSessionId;
    if (!sid) return;
    void sessionMutations.updateOpenCustomer.mutateAsync({
      sessionId: sid,
      customerName: next?.name ?? null,
      customerPhone: next?.phone ?? null,
    });
  };

  // Hydrate guest from open session (e.g. resume walk-in from table map).
  useEffect(() => {
    const sid = selectedTable?.sessionId ?? activeOpenSessionId;
    if (!sid) {
      lastHydratedSessionId.current = null;
      return;
    }
    if (lastHydratedSessionId.current === sid) return;
    const row = billListOpenSessions.rows.find((r) => r.session.id === sid);
    if (!row) return;
    const guestName = row.session.customer_name?.trim() || "";
    const guestPhone = row.session.customer_phone?.trim() || "";
    if (!guestName && !guestPhone) {
      lastHydratedSessionId.current = sid;
      return;
    }
    applySessionGuest(sid, guestName, guestPhone);
    // applySessionGuest is stable enough for session-id keyed hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOpenSessionId, billListOpenSessions.rows, organizationId, selectedTable?.sessionId]);

  const openSessionId = selectedTable?.sessionId ?? activeOpenSessionId;
  const cartPersistRef = useRef<string>("");
  useEffect(() => {
    if (!openSessionId || cart.lines.length === 0) return;
    const snapshot = JSON.stringify(cart.lines);
    if (snapshot === cartPersistRef.current) return;
    const timer = window.setTimeout(() => {
      cartPersistRef.current = snapshot;
      void sessionMutations.updateOpenCart.mutateAsync({
        sessionId: openSessionId,
        cartLines: cart.lines,
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [cart.lines, openSessionId, sessionMutations.updateOpenCart]);

  useEffect(() => {
    const options = pricing.outletSalesTypes;
    if (options.length === 0) {
      setSalesTypeId("");
      return;
    }
    if (!options.some((row) => row.id === salesTypeId)) {
      setSalesTypeId(options[0].id);
    }
  }, [pricing.outletSalesTypes, salesTypeId]);

  useEffect(() => {
    setPageIndex(0);
  }, [tab, catalog.data, favorites.orderedIds]);

  useEffect(() => {
    if (tab !== "favorit") {
      setFavoritesEditing(false);
      setAddFavoriteOpen(false);
    }
    if (tab !== "library") {
      setLibraryEditing(false);
      setLibraryQuery("");
      setLibraryView("home");
    }
  }, [tab]);

  const allItems = useMemo(() => {
    return (catalog.data ?? []).filter(
      (item) => item.kind !== "product" || !isCatalogProductHidden(item.posStatus),
    );
  }, [catalog.data]);

  const catalogById = useMemo(() => {
    const map = new Map<string, CustomerVisitCatalogItem>();
    for (const item of allItems) map.set(item.id, item);
    return map;
  }, [allItems]);

  const favoriteItems = useMemo(() => {
    return favorites.orderedIds
      .map((id) => catalogById.get(id))
      .filter((item): item is CustomerVisitCatalogItem => Boolean(item));
  }, [catalogById, favorites.orderedIds]);

  const favoriteIdSet = useMemo(() => new Set(favorites.orderedIds), [favorites.orderedIds]);

  const productItems = useMemo(
    () => allItems.filter((item) => item.kind === "product"),
    [allItems],
  );

  const bundleCatalogItems = useMemo(
    () =>
      (outletBundles.data ?? []).map((bundle) =>
        mapPosBundleToCatalogItem(
          bundle,
          resolvePosBundleUnitPrice(bundle, salesTypeId || null),
        ),
      ),
    [outletBundles.data, salesTypeId],
  );

  const librarySections = useMemo(
    () =>
      buildPosLibrarySections({
        categories: libraryCategories.categories,
        products: productItems,
        orderByCategoryId: libraryCategories.orderByCategoryId,
      }),
    [libraryCategories.categories, libraryCategories.orderByCategoryId, productItems],
  );

  const libraryPaneItems = useMemo(() => {
    if (libraryView === "home") return [];
    if (libraryView.type === "bundles") return bundleCatalogItems;
    if (libraryView.type !== "products") return [];
    if (libraryView.sectionId === "all_products") return productItems;
    return productItems.filter((item) => item.productCategoryId === libraryView.sectionId);
  }, [bundleCatalogItems, libraryView, productItems]);

  const onOpenLibrarySection = (section: PosLibrarySection) => {
    if (section.kind === "system") {
      if (section.id === "all_products") {
        setLibraryView({
          type: "products",
          sectionId: "all_products",
          title: t(section.labelKey, section.fallbackLabel),
        });
        return;
      }
      if (section.id === "all_bundles") {
        setLibraryView({
          type: "bundles",
          title: t(section.labelKey, section.fallbackLabel),
        });
        return;
      }
      setLibraryView({
        type: "soon",
        title: t(section.labelKey, section.fallbackLabel),
      });
      return;
    }
    setLibraryView({
      type: "products",
      sectionId: section.id,
      title: section.name,
    });
  };

  const onReorderLibraryCategories = (orderedCategoryIds: string[]) => {
    void libraryCategories.reorderCategories.mutateAsync(orderedCategoryIds).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_CASHIER_I18N.libraryReorderError, "Failed to reorder categories"),
        description: message,
        variant: "destructive",
      });
    });
  };

  const onReorderFavorites = (orderedIds: string[]) => {
    void favorites.reorderFavorites.mutateAsync(orderedIds).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_CASHIER_I18N.favoritReorderError, "Failed to reorder favorites"),
        description: message,
        variant: "destructive",
      });
    });
  };

  const onRemoveFavorite = (catalogId: string) => {
    void favorites.removeFavorite.mutateAsync(catalogId).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_CASHIER_I18N.favoritRemoveError, "Failed to remove favorite"),
        description: message,
        variant: "destructive",
      });
    });
  };

  const onAddFavorite = (item: CustomerVisitCatalogItem) => {
    if (favorites.maxReached) {
      toast({
        title: t(POS_CASHIER_I18N.favoritMaxReached, "Favorite limit reached (100)."),
        variant: "destructive",
      });
      return;
    }
    void favorites.addFavorite.mutateAsync(item.id).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_CASHIER_I18N.favoritAddError, "Failed to add favorite"),
        description: message,
        variant: "destructive",
      });
    });
  };

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (permissions.isLoading) {
    return null;
  }

  if (!permissions.canCharge()) {
    return (
      <Navigate
        to={resolvePosPostOutletPath({
          canCharge: false,
          canKitchenDisplay: permissions.canKitchenDisplay(),
        })}
        replace
      />
    );
  }

  const salesTypeLabel =
    pricing.outletSalesTypes.find((row) => row.id === salesTypeId)?.name || "Dine in";

  const buildPortionFromSelection = (selection: Map<string, number>) =>
    splitCartLinesByQty(cart.lines, selection);

  const openLoyaltyForPortion = (mode: "split" | "full", selection: Map<string, number>) => {
    setCheckoutMode(mode);
    setSplitSelection(selection);
    setLoyaltyResult({
      customer: posLoyaltyIdentityFromCashier(customer),
      reward: null,
    });
    setSplitBillOpen(false);
    setLoyaltyOpen(true);
  };

  const startFullPayCheckout = () => {
    if (cart.lines.length === 0 || checkoutTotals.grandTotal <= 0) return;
    const selection = buildFullCartSelection(cart.lines);
    const { splitLines } = buildPortionFromSelection(selection);
    const { catalogLines, customTotal } = splitPosCartLines(splitLines);
    const priced = pricing.compute(catalogLines);
    const amountDue = priced.grandTotal + Math.max(0, Math.round(customTotal));
    if (cart.lines.length > 0 && amountDue <= 0) {
      toast({
        title: t(
          POS_CASHIER_I18N.payAmountDueInvalid,
          "Cannot open payment: bill amount is zero.",
        ),
        variant: "destructive",
      });
      return;
    }
    openLoyaltyForPortion("full", selection);
  };

  const portionPreview = (() => {
    if (!splitSelection) {
      return {
        splitLines: [] as CustomerVisitCartLine[],
        remainderLines: [] as CustomerVisitCartLine[],
        amountDue: 0,
      };
    }
    const { splitLines, remainderLines } = buildPortionFromSelection(splitSelection);
    const { catalogLines, customTotal } = splitPosCartLines(splitLines);
    const priced = pricing.compute(catalogLines);
    const rewardedCatalogGrand = applyPosRewardToTotal(
      priced.grandTotal,
      loyaltyResult.reward,
    );
    const amountDue = rewardedCatalogGrand + Math.max(0, Math.round(customTotal));
    return {
      splitLines,
      remainderLines,
      amountDue,
    };
  })();

  const printErrorToast = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof PosPrinterUnavailableError || msg.includes("only available")) {
      toast({
        title: t(
          POS_SETTINGS_I18N.printerBluetoothUnavailable,
          "Bluetooth printers are only available in the Synckerja Android app.",
        ),
        variant: "destructive",
      });
      return;
    }
    if (msg === "no_receipt_printer") {
      toast({
        title: t(POS_SETTINGS_I18N.printerNoReceiptPrinter, "No printer assigned for Receipt/Bill"),
        variant: "destructive",
      });
      return;
    }
    if (msg === "no_ticket_printer") {
      toast({
        title: t(POS_SETTINGS_I18N.printerNoTicketPrinter, "No printer assigned for Order Tickets"),
        variant: "destructive",
      });
      return;
    }
    toast({
      title: t(POS_SETTINGS_I18N.printerPrintError, "Print failed"),
      description: msg,
      variant: "destructive",
    });
  };

  const fireKitchenOnSaveBill = async (
    linesSnapshot: typeof cart.lines,
    sessionId: string,
    meta: { posTableId?: string | null; tableName: string },
  ) => {
    if (!organizationId || !outletId) return;
    try {
      const result = await fireKitchenForCheckout({
        organizationId,
        outletId,
        outletName,
        sessionId,
        cartLines: linesSnapshot,
        event: "save_bill",
        salesTypeLabel,
        salesTypeId: salesTypeId || null,
        tableName: meta.tableName,
        posTableId: meta.posTableId ?? null,
        customerName: customer?.name ?? null,
      });
      if (result.stockCommitted) {
        void invalidateCatalogStockCaches(queryClient, organizationId);
      }
      toastKitchenFireResult({ result, t, toast });
      if (synckerjaCashierCheckout && !synckerjaCashierCheckout.kitchenFired) {
        await markSynckerjaCashierKitchenFired({
          pendingCheckoutId: synckerjaCashierCheckout.pendingCheckoutId,
          outletId,
        });
        setSynckerjaCashierCheckout((prev) =>
          prev ? { ...prev, kitchenFired: true } : prev,
        );
      }
    } catch (err) {
      const stockToast = resolveCheckoutStockToast(err, t);
      if (stockToast) {
        toast({ ...stockToast, variant: "destructive" });
        return;
      }
      console.error("fireKitchenForCheckout save_bill failed", err);
      printErrorToast(err);
    }
  };

  const finishSavedBill = () => {
    cart.reset();
    clearPosSelectedTable();
    setSelectedTable(null);
    setActiveOpenSessionId(null);
    setSynckerjaCashierCheckout(null);
    setNewBillPick(null);
    setSelectTableOpen(false);
    guestHydrateGen.current += 1;
    lastHydratedSessionId.current = null;
    setCustomer(null);
  };

  const ensureShiftForSave = (): boolean => {
    if (shiftWaiter.shiftOpen && shiftWaiter.waiter?.userId) return true;
    toast({
      title: t(
        POS_NEW_BILL_I18N.shiftRequired,
        "Start a shift before saving an open bill.",
      ),
      variant: "destructive",
    });
    setSelectTableOpen(false);
    setNewBillPick(null);
    navigate(`${POS_AUTH_PATHS.shift}?section=current`, { replace: true });
    return false;
  };

  const onSaveBill = () => {
    if (cart.lines.length === 0) return;
    setSelectTableOpen(true);
  };

  const onSaveAsWalkInBill = async () => {
    if (cart.lines.length === 0 || !outletId) return;
    if (!ensureShiftForSave()) return;
    const linesSnapshot = [...cart.lines];
    setSaveBusy(true);
    try {
      const session = await sessionMutations.upsertOpen.mutateAsync({
        outletId,
        groupId: null,
        posTableId: null,
        tableName: t(POS_SELECT_TABLE_I18N.walkInName, "Walk-in"),
        pax: 1,
        cartLines: linesSnapshot,
        waiterId: shiftWaiter.waiter!.userId,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
      });
      toast({ title: t(POS_SELECT_TABLE_I18N.saved, "Bill saved") });
      if (organizationId) {
        const { reserveFulfillmentStockIfNeeded } = await import(
          "@/stock-management/stock-commit/lib/stockCommitOrchestrator"
        );
        await reserveFulfillmentStockIfNeeded({
          organizationId,
          outletId,
          sessionId: session.id,
          cartLines: linesSnapshot,
        });
      }
      finishSavedBill();
      await fireKitchenOnSaveBill(linesSnapshot, session.id, {
        posTableId: null,
        tableName: t(POS_SELECT_TABLE_I18N.walkInName, "Walk-in"),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_SELECT_TABLE_I18N.saveError, "Failed to save bill"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaveBusy(false);
    }
  };

  const onContinueSelectTable = (pick: PosSelectTablePick) => {
    if (!ensureShiftForSave()) return;
    setNewBillPick(pick);
  };

  const onAssignPayFirstTable = async (pick: PosSelectTablePick) => {
    if (!paySuccess?.sessionId) return;
    setAssignTableBusy(true);
    try {
      await assignPayFirstTable({
        sessionId: paySuccess.sessionId,
        posTableId: pick.id,
        groupId: pick.groupId,
        tableName: pick.name,
      });
      setPaySuccess((prev) =>
        prev
          ? { ...prev, tableLabel: pick.name, needsTablePick: true }
          : prev,
      );
      setPickTableAfterPayOpen(false);
      void queryClient.invalidateQueries({ queryKey: [POS_TABLE_SESSIONS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_TICKETS_QUERY_KEY] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_SELECT_TABLE_I18N.saveError, "Failed to save bill"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setAssignTableBusy(false);
    }
  };

  const onConfirmNewBill = async (args: { pax: number; waiterId: string }) => {
    if (!newBillPick || !outletId || cart.lines.length === 0) return;
    const linesSnapshot = [...cart.lines];
    const pick = newBillPick;
    setSaveBusy(true);
    try {
      const session = await sessionMutations.upsertOpen.mutateAsync({
        outletId,
        groupId: pick.groupId,
        posTableId: pick.id,
        tableName: pick.name,
        pax: args.pax,
        cartLines: linesSnapshot,
        waiterId: args.waiterId,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
      });
      toast({ title: t(POS_NEW_BILL_I18N.saved, "Bill saved") });
      if (organizationId) {
        const { reserveFulfillmentStockIfNeeded } = await import(
          "@/stock-management/stock-commit/lib/stockCommitOrchestrator"
        );
        await reserveFulfillmentStockIfNeeded({
          organizationId,
          outletId,
          sessionId: session.id,
          cartLines: linesSnapshot,
        });
      }
      finishSavedBill();
      await fireKitchenOnSaveBill(linesSnapshot, session.id, {
        posTableId: pick.id,
        tableName: pick.name,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        title: t(POS_NEW_BILL_I18N.saveError, "Failed to save bill"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaveBusy(false);
    }
  };

  const onAddCatalogItem = (item: CustomerVisitCatalogItem) => {
    if (isCatalogItemOutOfStock(item)) {
      toast({
        title: t(POS_CASHIER_I18N.recipeOutOfStock, "Out of stock"),
        variant: "destructive",
      });
      return;
    }
    if (recipeOutOfStockIds.has(item.id)) {
      const label = recipeOutOfStockLabel(t, recipeOutOfStockReasons.get(item.id));
      toast({
        title: label.title,
        variant: "destructive",
      });
      return;
    }
    if (needsItemCustomize(item)) {
      setCustomizeItem(item);
      return;
    }
    cart.addItem(item);
  };

  const onUpdateQtyGuarded = (lineKey: string, quantity: number) => {
    const line = cart.lines.find((l) => l.lineKey === lineKey);
    if (!line) return;
    if (quantity >= line.quantity || line.isCustomAmount) {
      cart.updateQty(lineKey, quantity);
      return;
    }
    const voidQty = line.quantity - Math.max(0, quantity);
    if (voidQty <= 0) {
      cart.updateQty(lineKey, quantity);
      return;
    }

    const sessionId = selectedTable?.sessionId ?? activeOpenSessionId ?? null;
    // Draft cart (not saved): free qty edit — no void reason popup.
    if (!sessionId) {
      cart.updateQty(lineKey, quantity);
      return;
    }

    // Saved bill: only ask reason when removing the whole line.
    // Partial −1/−N applies silently with a default reason (avoids popup every tap).
    if (quantity > 0) {
      void applyProductVoid({
        lineKey,
        catalogId: line.catalogId,
        nextQty: quantity,
        line,
        voidQty,
        reason: t(
          POS_BILL_LIST_I18N.voidReasonQtyReduced,
          "Quantity reduced on bill",
        ),
        requirePin: false,
      });
      return;
    }

    setPendingVoid({
      lineKey,
      catalogId: line.catalogId,
      nextQty: quantity,
      line,
      voidQty,
    });
  };

  const applyProductVoid = (payload: {
    lineKey: string;
    catalogId: string;
    nextQty: number;
    line: CustomerVisitCartLine;
    voidQty: number;
    reason: string;
    requirePin: boolean;
  }) => {
    if (!outletId) return;
    const run = () => {
      void (async () => {
        setReasonBusy(true);
        try {
          await lineVoids.insertVoid.mutateAsync({
            outletId,
            sessionId: selectedTable?.sessionId ?? activeOpenSessionId ?? null,
            catalogItemId: payload.line.isCustomAmount ? null : payload.line.catalogId,
            productName: catalogItemLabel(payload.line),
            quantity: payload.voidQty,
            unitPrice: payload.line.unitPrice,
            reason: payload.reason,
          });
          const sessionId = selectedTable?.sessionId ?? activeOpenSessionId;
          if (organizationId && sessionId) {
            await reverseKitchenStockForVoid({
              organizationId,
              sessionId,
              line: payload.line,
              voidQty: payload.voidQty,
              reverseId: crypto.randomUUID(),
            });
            void invalidateCatalogStockCaches(queryClient, organizationId);
            if (!payload.line.isCustomAmount) {
              try {
                await applyKitchenTicketLineVoid({
                  sessionId,
                  lineFingerprint: cartLineFingerprint(payload.line),
                  voidQty: payload.voidQty,
                });
              } catch (kdsErr) {
                console.error("applyKitchenTicketLineVoid failed", kdsErr);
              }
            }
          }
          cart.updateQty(payload.lineKey, payload.nextQty);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toast({
            title: t(POS_CASHIER_I18N.payError, "Payment failed"),
            description: message,
            variant: "destructive",
          });
        } finally {
          setReasonBusy(false);
        }
      })();
    };
    if (payload.requirePin) {
      runWithPin(POS_PIN_FEATURES.cancelInvoices, run);
    } else {
      run();
    }
  };

  const confirmProductVoid = (reason: string) => {
    if (!pendingVoid || !outletId) return;
    const payload = pendingVoid;
    setPendingVoid(null);
    applyProductVoid({ ...payload, reason, requirePin: true });
  };

  const onSelectOpenBill = (row: PosBillListRow) => {
    const snap = Array.isArray(row.session.cart_snapshot)
      ? row.session.cart_snapshot
      : [];
    setActiveOpenSessionId(row.session.id);
    const guestName = row.session.customer_name?.trim() || "";
    const guestPhone = row.session.customer_phone?.trim() || "";
    if (guestName || guestPhone) {
      applySessionGuest(row.session.id, guestName, guestPhone);
    } else {
      guestHydrateGen.current += 1;
      lastHydratedSessionId.current = row.session.id;
      setCustomer(null);
    }
    if (!row.session.pos_table_id || !row.session.group_id) {
      clearPosSelectedTable();
      setSelectedTable(null);
      cart.replaceLines(snap);
      setCartRestored(true);
      setBillListOpen(false);
      return;
    }
    const next: PosSelectedTable = {
      id: row.session.pos_table_id,
      name: row.session.table_name,
      groupId: row.session.group_id,
      pax: row.session.pax,
      outletId: row.session.outlet_id,
      sessionId: row.session.id,
      seatedAt: row.session.seated_at,
      cartSnapshot: null,
    };
    setSelectedTable(next);
    stashPosSelectedTable(next);
    cart.replaceLines(snap);
    setCartRestored(true);
    setBillListOpen(false);
  };

  const onClaimCashierQr = (claimToken: string) => {
    if (!outletId || !organizationId || claimScanBusyRef.current) return;
    claimScanBusyRef.current = true;
    void (async () => {
      try {
        const claim = await claimSynckerjaCashierCheckout({
          claimToken,
          outletId,
        });
        if (!claim.ok || !claim.session_id) {
          toast({
            title: t(POS_CASHIER_I18N.cashierQrClaimError, "Could not load order"),
            description: resolveCashierQrClaimErrorMessage(claim.error, t),
            variant: "destructive",
          });
          return;
        }
        const session = claimedCashierToBillSession(claim, outletId, organizationId);
        if (!session) {
          toast({
            title: t(POS_CASHIER_I18N.cashierQrClaimError, "Could not load order"),
            variant: "destructive",
          });
          return;
        }
        onSelectOpenBill({ session, groupName: "", waiterName: "" });
        const salesTypes = pricing.outletSalesTypes;
        const matchById = claim.catalog_sales_type_id
          ? salesTypes.find((row) => row.id === claim.catalog_sales_type_id)
          : undefined;
        const label = (claim.sales_type_label ?? "").toLowerCase();
        const matchByLabel =
          matchById ??
          salesTypes.find((row) => {
            const name = row.name.toLowerCase();
            if (claim.fulfillment === "takeaway" || label.includes("take") || label.includes("bawa")) {
              return name.includes("take") || name.includes("bawa");
            }
            return name.includes("dine");
          });
        if (matchByLabel?.id) {
          setSalesTypeId(matchByLabel.id);
        }
        if (claim.pending_checkout_id) {
          setSynckerjaCashierCheckout({
            pendingCheckoutId: claim.pending_checkout_id,
            kitchenFired: Boolean(claim.kitchen_fired),
          });
        }
        void queryClient.invalidateQueries({ queryKey: [POS_TABLE_SESSIONS_QUERY_KEY] });
        const fulfillmentHint =
          claim.fulfillment === "takeaway" ||
          (claim.sales_type_label ?? "").toLowerCase().includes("take") ||
          (claim.sales_type_label ?? "").toLowerCase().includes("bawa")
            ? "Take Away"
            : "Dine In";
        toast({
          title: t(POS_CASHIER_I18N.cashierQrClaimSuccess, "Guest order loaded"),
          description: `${fulfillmentHint} · ${session.table_name}`,
        });
      } finally {
        claimScanBusyRef.current = false;
      }
    })();
  };

  usePosCashierQrScan({
    enabled: Boolean(outletId && organizationId),
    onScan: onClaimCashierQr,
  });

  const onFulfillOpenBill = (row: PosBillListRow) => {
    if (!outletId) return;
    const lines = Array.isArray(row.session.cart_snapshot)
      ? row.session.cart_snapshot
      : [];
    void (async () => {
      try {
        await fulfillStock.mutateAsync({
          outletId,
          sessionId: row.session.id,
          cartLines: lines,
        });
        toast({
          title: t(POS_STOCK_COMMIT_I18N.fulfillSuccess, "Order marked as shipped"),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: t(POS_STOCK_COMMIT_I18N.fulfillError, "Failed to complete shipment"),
          description: message,
          variant: "destructive",
        });
      }
    })();
  };

  const confirmCancelBill = (reason: string) => {
    if (!cancelTarget) return;
    const sessionId = cancelTarget.session.id;
    setCancelTarget(null);
    runWithPin(POS_PIN_FEATURES.manageOpenBills, () => {
      void (async () => {
        setReasonBusy(true);
        try {
          await sessionMutations.cancelOpen.mutateAsync({
            sessionId,
            reason,
            organizationId: organizationId ?? undefined,
            outletId: outletId ?? undefined,
          });
          if (selectedTable?.sessionId === sessionId || activeOpenSessionId === sessionId) {
            clearPosSelectedTable();
            setSelectedTable(null);
            setActiveOpenSessionId(null);
            cart.reset();
          }
          toast({
            title: t(POS_BILL_LIST_I18N.cancelSuccess, "Bill cancelled"),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toast({
            title: t(POS_CASHIER_I18N.payError, "Payment failed"),
            description: message,
            variant: "destructive",
          });
        } finally {
          setReasonBusy(false);
        }
      })();
    });
  };

  const onRefundPaidBill = (row: PosBillListRow) => {
    const activityId = row.session.sales_activity_id;
    if (!activityId) {
      toast({
        title: t(POS_STOCK_COMMIT_I18N.refundError, "Failed to refund checkout stock"),
        description: t(
          POS_STOCK_COMMIT_I18N.refundActivityRequired,
          "This paid bill has no sales activity to refund.",
        ),
        variant: "destructive",
      });
      return;
    }
    if (row.refundStatus === "full") {
      toast({
        title: t(POS_BILL_LIST_I18N.refundedBadge, "Refunded"),
      });
      return;
    }
    runWithPin(POS_PIN_FEATURES.issueRefunds, () => {
      void (async () => {
        setRefundBusyId(row.session.id);
        try {
          await checkoutRefund.mutateAsync({
            activityId,
            sessionId: row.session.id,
            outletId: row.session.outlet_id ?? outletId,
            shiftId: openShiftQuery.data?.id ?? null,
          });
          toast({
            title: t(POS_STOCK_COMMIT_I18N.refundSuccess, "Checkout stock refunded"),
          });
          void billListPaid.refetch();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toast({
            title: t(POS_STOCK_COMMIT_I18N.refundError, "Failed to refund checkout stock"),
            description: message,
            variant: "destructive",
          });
        } finally {
          setRefundBusyId(null);
        }
      })();
    });
  };

  const onNewBillFromList = () => {
    if (cart.lines.length > 0) {
      const ok = window.confirm(
        t(
          POS_BILL_LIST_I18N.newBillConfirm,
          "Clear the current bill and start a new walk-in bill?",
        ),
      );
      if (!ok) return;
    }
    cart.reset();
    clearPosSelectedTable();
    setSelectedTable(null);
    setActiveOpenSessionId(null);
    setBillListOpen(false);
  };

  const onPrintBill = async () => {
    if (cart.lines.length === 0) return;
    try {
      await printPosReceiptBill({
        outletId,
        outletName,
        lines: cart.lines,
        checkoutTotals,
        customerName: customer?.name,
        isBillDraft: true,
      });
      toast({ title: t(POS_SETTINGS_I18N.printerBillPrinted, "Bill printed") });
    } catch (err) {
      printErrorToast(err);
    }
  };

  const clearCheckoutFlow = () => {
    setSplitBillOpen(false);
    setLoyaltyOpen(false);
    setPaymentOpen(false);
    setQrisOpen(false);
    setQrisFlow(null);
    setCheckoutMode(null);
    setSplitSelection(null);
    setLoyaltyResult({ customer: null, reward: null });
  };

  const onQrisPaid = async (args: {
    salesActivityId: string | null;
  }) => {
    if (!qrisFlow || !outletId || !organizationId) return;
    const {
      splitLines,
      remainderLines,
      keepOpen,
      paidCatalogTotals,
      customTotal,
      clientName,
      catalogLines,
      leadId,
      boundByPhone,
      clientPhone,
      kitchenCheckout,
      paySessionId,
      posTableId,
      servedByUserId,
    } = qrisFlow;

    setQrisOpen(false);

    if (args.salesActivityId && boundByPhone) {
      const phoneKey = normalizeCustomerVisitPhone(clientPhone);
      if (phoneKey) {
        try {
          await recordPosPaidCustomerVisit({
            organizationId,
            leadId,
            salesActivityId: args.salesActivityId,
            phoneKey,
            lookupRaw: clientPhone,
            boundByPhone: true,
          });
        } catch (visitErr) {
          console.error("recordPosPaidCustomerVisit qris failed", visitErr);
        }
      }
    }

    let paidSessionId: string | null = paySessionId;
    if (args.salesActivityId && catalogLines.length > 0) {
      try {
        const { sessionId: kdsSessionId, result } = await runKitchenFireOnPay({
          organizationId,
          outletId,
          outletName,
          sessionId: paySessionId,
          cartLines: catalogLines,
          salesTypeId: salesTypeId || null,
          posTableId,
          clientPhone: null,
          servedByUserId,
          salesActivityId: args.salesActivityId,
          kitchenCheckout,
          keepPayFirstSessionOpen: shouldKeepPayFirstSessionOpen({
            existingSessionId: paySessionId,
            salesTypeLabel: kitchenCheckout.salesTypeLabel,
          }),
        });
        paidSessionId = kdsSessionId;
        if (result.stockCommitted) {
          void invalidateCatalogStockCaches(queryClient, organizationId);
        }
        toastKitchenFireResult({ result, t, toast });
        if (kdsSessionId && !keepOpen) {
          await applyKitchenAutoDoneOnPay({
            sessionId: kdsSessionId,
            kitchenCheckout,
          });
        }
      } catch (kitchenErr) {
        const stockToast = resolveCheckoutStockToast(kitchenErr, t);
        if (stockToast) toast({ ...stockToast, variant: "destructive" });
        else console.error("runKitchenFireOnPay qris failed", kitchenErr);
      }
    }

    await markLeadConvertedIfNeeded({
      orgId: organizationId,
      leadId,
      changedBy: null,
    });

    if (keepOpen) {
      cart.replaceLines(remainderLines);
      if (selectedTable) {
        const next = { ...selectedTable, cartSnapshot: null };
        setSelectedTable(next);
        stashPosSelectedTable(next);
      }
    } else {
      cart.reset();
      clearPosSelectedTable();
      setSelectedTable(null);
      setActiveOpenSessionId(null);
    }

    void queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["customer-visits", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["sales-activities", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["income-transactions", organizationId] });
    void invalidateCatalogStockCaches(queryClient, organizationId);
    void queryClient.invalidateQueries({ queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [POS_TABLE_SESSIONS_QUERY_KEY] });

    const totalsSnapshot = mergePosCheckoutTotalsWithCustom(paidCatalogTotals, customTotal);
    const displayAmountDue =
      paidCatalogTotals.grandTotal + Math.max(0, Math.round(customTotal));

    clearCheckoutFlow();
    if (synckerjaCashierCheckout && outletId && paidSessionId) {
      await completeSynckerjaCashierCheckout({
        pendingCheckoutId: synckerjaCashierCheckout.pendingCheckoutId,
        sessionId: paidSessionId,
        salesActivityId: args.salesActivityId,
        outletId,
      });
    }
    const qrisSeating = paySuccessTablePickState({
      salesTypeLabel,
      hadOpenSessionBeforePay: Boolean(paySessionId),
      posTableId,
      sessionId: paidSessionId,
      tableName: selectedTable?.name ?? kitchenCheckout.tableName,
    });
    setPaySuccess({
      amountDue: displayAmountDue,
      cashTendered: null,
      paymentMethod: "qris",
      walletLabel: "QRIS",
      customerName: clientName,
      activityId: args.salesActivityId,
      leadId,
      linesSnapshot: splitLines,
      totalsSnapshot,
      sessionId: paidSessionId,
      needsTablePick: qrisSeating.needsTablePick,
      tableLabel: qrisSeating.tableLabel,
      checkoutChannel: paySuccessCheckoutChannel,
    });
    void markSynckerjaKitchenIfNeeded();

    const prefs = getPosTicketPrintPrefs(outletId);
    try {
      if (prefs.hasReceiptPrinter && catalogLines.length > 0) {
        await printPosReceiptBill({
          outletId,
          outletName,
          lines: splitLines,
          checkoutTotals: totalsSnapshot,
          customerName: clientName,
          isBillDraft: false,
        });
      }
    } catch (printErr) {
      printErrorToast(printErr);
    }
  };

  const onConfirmPayment = async (payload: PosPaymentConfirmPayload) => {
    if (!outletId || !splitSelection) return;
    const { splitLines, remainderLines } = buildPortionFromSelection(splitSelection);
    if (splitLines.length === 0) return;
    const { catalogLines, customLines, customTotal } = splitPosCartLines(splitLines);
    const catalogTotals = pricing.compute(catalogLines);
    const reward = loyaltyResult.reward;
    // Apply reward as a reduction on catalog grand total only (v1).
    const paidCatalogTotals =
      reward && catalogTotals.grandTotal > 0
        ? {
            ...catalogTotals,
            grandTotal: applyPosRewardToTotal(catalogTotals.grandTotal, reward),
          }
        : catalogTotals;
    const keepOpen = remainderLines.length > 0;
    const liveOpenSession = openSessionId
      ? billListOpenSessions.rows.find((r) => r.session.id === openSessionId)?.session
      : null;
    const clientName =
      loyaltyResult.customer?.name ||
      customer?.name ||
      liveOpenSession?.customer_name?.trim() ||
      "Walk-in";
    const clientPhone =
      loyaltyResult.customer?.phone ||
      customer?.phone ||
      liveOpenSession?.customer_phone?.trim() ||
      null;

    if (payload.paymentMethod === "qris") {
      if (catalogLines.length === 0 || paidCatalogTotals.grandTotal <= 0) {
        toast({
          title: t("pos.payment.qris.errors.amountTooLow", "QRIS requires a catalog total of at least Rp 1.500"),
          variant: "destructive",
        });
        return;
      }
      if (!organizationId) throw new Error("Organization ID is required");

      setPortionPayBusy(true);
      try {
        if (customLines.some((line) => lineTotal(line) > 0)) {
          await payPosCustomCashIns({
            organizationId,
            outletId,
            customLines,
          });
          void queryClient.invalidateQueries({ queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY] });
          void queryClient.invalidateQueries({ queryKey: [POS_CASH_MOVEMENTS_QUERY_KEY] });
        }

        const paySessionId = selectedTable?.sessionId ?? activeOpenSessionId;
        const kitchenTableName =
          selectedTable?.name ?? t(POS_SELECT_TABLE_I18N.walkInName, "Walk-in");
        const kitchenCheckout = await buildKitchenPayCheckoutContext({
          organizationId,
          outletId,
          outletName,
          sessionId: paySessionId,
          tableName: kitchenTableName,
          salesTypeLabel,
          salesTypeId: salesTypeId || null,
          customerName: clientName,
        });
        const servedByUserId = resolveServedByUserId(paySessionId);
        const { checkout, leadId, boundByPhone } = await preparePosQrisCheckout({
          organizationId,
          outletId,
          clientName,
          clientPhone,
          catalogLines,
          paidCatalogTotals,
          salesTypeId: salesTypeId || null,
          tableNumber: selectedTable?.name ?? null,
          posTableId: selectedTable?.id ?? null,
          sessionId: paySessionId,
          seatedAt: selectedTable?.seatedAt ?? null,
          servedByUserId,
          keepSessionOpen: keepOpen,
          remainderCartLines: keepOpen ? remainderLines : null,
          paymentChannelId: payload.paymentChannelId,
        });

        setQrisFlow({
          checkout,
          leadId,
          boundByPhone,
          clientPhone,
          amountDue:
            paidCatalogTotals.grandTotal + Math.max(0, Math.round(customTotal)),
          splitLines,
          paidCatalogTotals,
          customTotal,
          clientName,
          catalogLines,
          keepOpen,
          remainderLines,
          kitchenCheckout,
          paySessionId,
          posTableId: selectedTable?.id ?? null,
          servedByUserId,
        });
        setPaymentOpen(false);
        setQrisOpen(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("shift_required") || message.includes("shift_not_open")) {
          toast({
            title: t(POS_SHIFT_I18N.shiftRequired, "Start a shift before taking payments."),
            variant: "destructive",
          });
          navigate(`${POS_AUTH_PATHS.shift}?section=current`, { replace: true });
          return;
        }
        const payToast = resolvePosPayFailureToast(err, t);
        toast(payToast ?? {
          title: t("pos.payment.qris.errors.generic", "QRIS payment failed"),
          description: message,
          variant: "destructive",
        });
      } finally {
        setPortionPayBusy(false);
      }
      return;
    }

    setPortionPayBusy(true);
    try {
      if (customLines.some((line) => lineTotal(line) > 0)) {
        if (!organizationId) throw new Error("Organization ID is required");
        await payPosCustomCashIns({
          organizationId,
          outletId,
          customLines,
        });
        void queryClient.invalidateQueries({ queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY] });
        void queryClient.invalidateQueries({ queryKey: [POS_CASH_MOVEMENTS_QUERY_KEY] });
      }

      let activityId: string | null = null;
      let leadId: string | null = null;
      const paySessionId = selectedTable?.sessionId ?? activeOpenSessionId;
      let paidSessionId: string | null = paySessionId;

      if (catalogLines.length > 0 && paidCatalogTotals.grandTotal > 0) {
        const kitchenTableName =
          selectedTable?.name ?? t(POS_SELECT_TABLE_I18N.walkInName, "Walk-in");
        const kitchenCheckout = organizationId
          ? await buildKitchenPayCheckoutContext({
              organizationId,
              outletId,
              outletName,
              sessionId: paySessionId,
              tableName: kitchenTableName,
              salesTypeLabel,
              salesTypeId: salesTypeId || null,
              customerName: clientName,
            })
          : undefined;

        const result = await pay.mutateAsync({
          clientName,
          clientPhone,
          paymentMethod: payload.paymentMethod,
          paymentChannelId: payload.paymentChannelId,
          paymentReference: payload.paymentReference,
          cashTendered:
            payload.paymentMethod === "cash"
              ? payload.cashTendered
              : paidCatalogTotals.grandTotal,
          outletId,
          salesTypeId: salesTypeId || null,
          checkoutTotals: paidCatalogTotals,
          lines: catalogLines,
          tableNumber: selectedTable?.name ?? null,
          posTableId: selectedTable?.id ?? null,
          sessionId: paySessionId,
          seatedAt: selectedTable?.seatedAt ?? null,
          servedByUserId: resolveServedByUserId(paySessionId),
          keepSessionOpen: keepOpen,
          remainderCartLines: keepOpen ? remainderLines : null,
          kitchenCheckout,
        });
        activityId = result.activityId;
        leadId = result.leadId;
        paidSessionId = result.sessionId ?? paidSessionId;
        if (result.kitchenFireResult && organizationId) {
          if (result.kitchenFireResult.stockCommitted) {
            void invalidateCatalogStockCaches(queryClient, organizationId);
          }
          toastKitchenFireResult({ result: result.kitchenFireResult, t, toast });
        }
      } else if (customTotal <= 0) {
        return;
      } else {
        const sid = selectedTable?.sessionId ?? activeOpenSessionId;
        if (sid) {
          if (keepOpen) {
            await sessionMutations.updateOpenCart.mutateAsync({
              sessionId: sid,
              cartLines: remainderLines,
            });
          } else {
            let autoDoneKitchen = true;
            if (organizationId) {
              const kitchenTableName =
                selectedTable?.name ?? t(POS_SELECT_TABLE_I18N.walkInName, "Walk-in");
              const kitchenCheckout = await buildKitchenPayCheckoutContext({
                organizationId,
                outletId,
                outletName,
                sessionId: sid,
                tableName: kitchenTableName,
                salesTypeLabel,
                salesTypeId: salesTypeId || null,
                customerName: clientName,
              });
              autoDoneKitchen = shouldAutoDoneKitchenOnPay({
                hadKitchenTicketsBeforePay: kitchenCheckout.hadKitchenTicketsBeforePay,
                sessionWasOpenBeforePay: kitchenCheckout.sessionWasOpenBeforePay,
                salesTypeLabel: kitchenCheckout.salesTypeLabel,
                settings: kitchenCheckout.firePolicy,
              });
            }
            await sessionMutations.closeOpenCustomOnly.mutateAsync({
              sessionId: sid,
              autoDoneKitchen,
            });
          }
        }
      }

      if (keepOpen) {
        cart.replaceLines(remainderLines);
        if (selectedTable) {
          const next = { ...selectedTable, cartSnapshot: null };
          setSelectedTable(next);
          stashPosSelectedTable(next);
        }
      } else {
        cart.reset();
        clearPosSelectedTable();
        setSelectedTable(null);
        setActiveOpenSessionId(null);
        setSynckerjaCashierCheckout(null);
      }

      const totalsSnapshot = mergePosCheckoutTotalsWithCustom(
        paidCatalogTotals,
        customTotal,
      );
      const displayAmountDue =
        paidCatalogTotals.grandTotal + Math.max(0, Math.round(customTotal));

      clearCheckoutFlow();
      if (synckerjaCashierCheckout && outletId && paidSessionId) {
        await completeSynckerjaCashierCheckout({
          pendingCheckoutId: synckerjaCashierCheckout.pendingCheckoutId,
          sessionId: paidSessionId,
          salesActivityId: activityId,
          outletId,
        });
      }
      const cashSeating = paySuccessTablePickState({
        salesTypeLabel,
        hadOpenSessionBeforePay: Boolean(paySessionId),
        posTableId: selectedTable?.id ?? null,
        sessionId: paidSessionId,
        tableName: selectedTable?.name ?? null,
      });
      setPaySuccess({
        amountDue: displayAmountDue,
        cashTendered:
          payload.paymentMethod === "cash" ? payload.cashTendered : null,
        paymentMethod: payload.paymentMethod,
        walletLabel: payload.walletLabel,
        customerName: clientName,
        activityId,
        leadId,
        linesSnapshot: splitLines,
        totalsSnapshot,
        sessionId: paidSessionId,
        needsTablePick: cashSeating.needsTablePick,
        tableLabel: cashSeating.tableLabel,
        checkoutChannel: paySuccessCheckoutChannel,
      });
      void markSynckerjaKitchenIfNeeded();

      const prefs = getPosTicketPrintPrefs(outletId);
      try {
        if (prefs.hasReceiptPrinter && catalogLines.length > 0) {
          await printPosReceiptBill({
            outletId,
            outletName,
            lines: splitLines,
            checkoutTotals: totalsSnapshot,
            customerName: clientName,
            isBillDraft: false,
          });
        }
      } catch (printErr) {
        printErrorToast(printErr);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("pos_table_multiple_open_sessions")) {
        toast({
          title: t(
            POS_SELECT_TABLE_I18N.multipleOpenError,
            "This table has multiple open bills. Open the bill from the list or table map first.",
          ),
          variant: "destructive",
        });
        return;
      }
      if (message.includes("shift_required") || message.includes("shift_not_open")) {
        toast({
          title: t(POS_SHIFT_I18N.shiftRequired, "Start a shift before taking payments."),
          variant: "destructive",
        });
        navigate(`${POS_AUTH_PATHS.shift}?section=current`, { replace: true });
        return;
      }
      const payFailureToast = resolvePosPayFailureToast(err, t, {
        lines: catalogLines.map((line) => ({
          kind: line.kind,
          trackStock: line.trackStock,
          serviceName: line.serviceName,
          availableQty: line.availableQty,
          quantity: line.quantity,
          inventorySkuId: line.inventorySkuId,
        })),
        includeRollbackHint: true,
      });
      if (payFailureToast) {
        toast({
          ...payFailureToast,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: t(POS_CASHIER_I18N.payError, "Payment failed"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setPortionPayBusy(false);
    }
  };

  const onSendPaySuccessEmail = async (email: string, customerName: string) => {
    if (!paySuccess?.activityId || !paySuccess.leadId || !organizationId || !outletId) {
      return;
    }
    setSendingEmail(true);
    try {
      const result = await sendPosDigitalReceipt({
        organizationId,
        outletId,
        salesActivityId: paySuccess.activityId,
        leadId: paySuccess.leadId,
        clientName: customerName,
        channel: "email",
        email,
      });
      if (!result.ok) {
        const title =
          result.code === "share_disabled"
            ? t(POS_PAY_SUCCESS_I18N.shareEmailOff, "Email receipt is disabled in outlet receipt settings.")
            : result.code === "invalid_email"
              ? t(POS_PAY_SUCCESS_I18N.invalidEmail, "Enter a valid email address")
              : t(POS_PAY_SUCCESS_I18N.sendError, "Failed to send receipt");
        toast({ title, variant: "destructive" });
        return;
      }
      toast({ title: t(POS_PAY_SUCCESS_I18N.sendSuccess, "Receipt sent") });
    } finally {
      setSendingEmail(false);
    }
  };

  const onSendPaySuccessSms = async (phoneLocal: string, customerName: string) => {
    if (!paySuccess?.activityId || !paySuccess.leadId || !organizationId || !outletId) {
      return;
    }
    setSendingSms(true);
    try {
      const result = await sendPosDigitalReceipt({
        organizationId,
        outletId,
        salesActivityId: paySuccess.activityId,
        leadId: paySuccess.leadId,
        clientName: customerName,
        channel: "sms",
        phoneLocal,
      });
      if (!result.ok) {
        const title =
          result.code === "share_disabled"
            ? t(POS_PAY_SUCCESS_I18N.shareSmsOff, "SMS receipt is disabled in outlet receipt settings.")
            : result.code === "invalid_phone"
              ? t(POS_PAY_SUCCESS_I18N.invalidPhone, "Enter a valid phone number")
              : t(POS_PAY_SUCCESS_I18N.sendError, "Failed to send receipt");
        toast({ title, variant: "destructive" });
        return;
      }
      toast({ title: t(POS_PAY_SUCCESS_I18N.sendSuccess, "Receipt sent") });
    } finally {
      setSendingSms(false);
    }
  };

  const onPrintPaySuccessReceipt = async () => {
    if (!paySuccess || !outletId) return;
    setPrintingReceipt(true);
    try {
      await printPosReceiptBill({
        outletId,
        outletName,
        lines: paySuccess.linesSnapshot,
        checkoutTotals: paySuccess.totalsSnapshot,
        customerName: paySuccess.customerName,
        isBillDraft: false,
      });
      toast({ title: t(POS_SETTINGS_I18N.printerBillPrinted, "Bill printed") });
    } catch (err) {
      toast({
        title: t(POS_PAY_SUCCESS_I18N.printError, "Print failed"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setPrintingReceipt(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-[2] flex-col">
          {tab === "custom" ? (
            <PosCustomKeypad
              disabled={pay.isPending}
              onAdd={(amount, description) => {
                const line = createCustomCartLine({
                  amount,
                  label: description,
                });
                if (!line) {
                  toast({
                    title: t(
                      POS_CASHIER_I18N.customDescriptionRequired,
                      "Enter a reason for this cash receipt",
                    ),
                  });
                  return;
                }
                cart.addCustomAmount(line);
              }}
            />
          ) : catalog.isLoading ||
            (tab === "favorit" && favorites.isLoading) ||
            (tab === "library" &&
              (libraryCategories.isLoading || outletBundles.isLoading)) ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              …
            </div>
          ) : tab === "favorit" ? (
            <PosFavoritesGrid
              items={favoriteItems}
              pageIndex={pageIndex}
              onPageChange={setPageIndex}
              editing={favoritesEditing}
              onEnterEdit={() => setFavoritesEditing(true)}
              onAddItem={onAddCatalogItem}
              onRemoveFavorite={onRemoveFavorite}
              onReorder={onReorderFavorites}
              onOpenAddDialog={() => {
                if (favorites.maxReached) {
                  toast({
                    title: t(POS_CASHIER_I18N.favoritMaxReached, "Favorite limit reached (100)."),
                    variant: "destructive",
                  });
                  return;
                }
                setAddFavoriteOpen(true);
              }}
              disabled={pay.isPending}
              maxReached={favorites.maxReached}
              recipeOutOfStockIds={recipeOutOfStockIds}
              recipeOutOfStockReasons={recipeOutOfStockReasons}
            />
          ) : tab === "library" ? (
            libraryView === "home" ? (
              <PosLibraryHome
                sections={librarySections}
                query={libraryQuery}
                onQueryChange={setLibraryQuery}
                editing={libraryEditing}
                onEditingChange={setLibraryEditing}
                onOpenSection={onOpenLibrarySection}
                onReorderCategories={onReorderLibraryCategories}
              />
            ) : libraryView.type === "soon" ? (
              <PosLibrarySoonPane
                title={libraryView.title}
                onBack={() => setLibraryView("home")}
              />
            ) : (
              <PosLibraryProductPane
                title={libraryView.title}
                items={libraryPaneItems}
                emptyLabel={
                  libraryView.type === "bundles"
                    ? t(POS_CASHIER_I18N.libraryEmptyBundles, "No bundles found.")
                    : undefined
                }
                onBack={() => setLibraryView("home")}
                onAddItem={onAddCatalogItem}
                disabled={pay.isPending}
                recipeOutOfStockIds={recipeOutOfStockIds}
                recipeOutOfStockReasons={recipeOutOfStockReasons}
              />
            )
          ) : null}
        </section>

        {tab === "favorit" && favoritesEditing ? (
          <PosFavoritesEditPanel onDone={() => setFavoritesEditing(false)} />
        ) : (
          <PosCashierBillPanel
            lines={cart.lines}
            checkoutTotals={checkoutTotals}
            salesTypeId={salesTypeId}
            salesTypeOptions={pricing.outletSalesTypes}
            onSalesTypeChange={setSalesTypeId}
            customerLabel={posCashierCustomerBillLabel(customer)}
            onAddCustomer={() => setCustomerOpen(true)}
            tableLabel={selectedTable?.name ?? null}
            tableDuration={
              selectedTable?.seatedAt
                ? formatPosTableDuration(selectedTable.seatedAt, durationTick)
                : null
            }
            onClearTable={() => {
              clearPosSelectedTable();
              setSelectedTable(null);
              setActiveOpenSessionId(null);
            }}
            onUpdateQty={onUpdateQtyGuarded}
            onOpenBillList={() => {
              setBillListTab("open");
              setBillListOpen(true);
            }}
            onSaveBill={() => void onSaveBill()}
            saveBillDisabled={Boolean(selectedTable?.sessionId || activeOpenSessionId)}
            onPrintBill={() =>
              runWithPin(POS_PIN_FEATURES.printBill, () => {
                void onPrintBill();
              })
            }
            onSplitBill={() => {
              if (cart.lines.length === 0) return;
              setSplitBillOpen(true);
            }}
            onPay={startFullPayCheckout}
            paying={pay.isPending}
          />
        )}
      </div>

      <PosCashierBottomNav
        activeTab={tab}
        onTabChange={(next) => {
          setTab(next);
          setFavoritesEditing(false);
          setLibraryEditing(false);
        }}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <PosCashierMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        outletName={outletMeta?.name}
      />

      <PosAddCustomerDialog
        open={customerOpen}
        onOpenChange={setCustomerOpen}
        initial={customer}
        onSave={(next) => persistBillCustomer(next)}
        onRemove={() => persistBillCustomer(null)}
      />
      <PosAddFavoriteDialog
        open={addFavoriteOpen}
        onOpenChange={setAddFavoriteOpen}
        catalog={allItems}
        favoriteIds={favoriteIdSet}
        onSelect={onAddFavorite}
      />
      <PosSplitBillDialog
        open={splitBillOpen}
        onOpenChange={setSplitBillOpen}
        lines={cart.lines}
        salesTypeLabel={salesTypeLabel}
        computeTotals={(lines) => pricing.compute(lines)}
        onConfirmSplit={(selection) => openLoyaltyForPortion("split", selection)}
      />
      <PosLoyaltyDialog
        open={loyaltyOpen}
        onOpenChange={setLoyaltyOpen}
        outletId={outletId ?? ""}
        initialCustomer={customer}
        onSkip={() => {
          setLoyaltyResult(loyaltySkipResult(posLoyaltyIdentityFromCashier(customer)));
          setLoyaltyOpen(false);
          setPaymentOpen(true);
        }}
        onContinue={(result) => {
          setLoyaltyResult(result);
          if (result.customer) {
            persistBillCustomer(posCashierCustomerFromLoyalty(result.customer));
          }
          setLoyaltyOpen(false);
          setPaymentOpen(true);
        }}
        onBack={() => {
          setLoyaltyOpen(false);
          if (checkoutMode === "split") setSplitBillOpen(true);
          else clearCheckoutFlow();
        }}
      />
      <PosPaymentMethodDialog
        open={paymentOpen}
        outletId={outletId ?? ""}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentOpen(false);
            clearCheckoutFlow();
          }
        }}
        amountDue={portionPreview.amountDue}
        serverName={shiftWaiter.waiter?.fullName ?? ""}
        paying={portionPayBusy || pay.isPending}
        onConfirm={(payload) => void onConfirmPayment(payload)}
      />
      {organizationId && outletId && qrisFlow ? (
        <PosQrisPaymentDialog
          open={qrisOpen}
          onOpenChange={(open) => {
            setQrisOpen(open);
            if (!open) setQrisFlow(null);
          }}
          organizationId={organizationId}
          outletId={outletId}
          outletName={outletName}
          outletAddress={outletAddress}
          amountDue={qrisFlow.amountDue}
          isSandbox={qrisSandbox}
          checkout={qrisFlow.checkout}
          onPaid={({ salesActivityId }) => void onQrisPaid({ salesActivityId })}
          onCancel={() => {
            setQrisFlow(null);
            clearCheckoutFlow();
          }}
        />
      ) : null}
      <PosPaySuccessScreen
        open={Boolean(paySuccess)}
        payload={paySuccess}
        digitalEnabled={Boolean(paySuccess?.activityId && paySuccess?.leadId)}
        sendingEmail={sendingEmail}
        sendingSms={sendingSms}
        printing={printingReceipt}
        pickingTable={pickTableAfterPayOpen || assignTableBusy}
        onSendEmail={(email, name) => void onSendPaySuccessEmail(email, name)}
        onSendSms={(phone, name) => void onSendPaySuccessSms(phone, name)}
        onPrint={() => void onPrintPaySuccessReceipt()}
        onPickTable={() => setPickTableAfterPayOpen(true)}
        onNewTransaction={() => {
          setPickTableAfterPayOpen(false);
          setSynckerjaCashierCheckout(null);
          setPaySuccess(null);
        }}
      />
      <PosItemCustomizeDialog
        open={Boolean(customizeItem)}
        item={customizeItem}
        outletId={outletId}
        billSalesTypeId={salesTypeId || null}
        onCancel={() => setCustomizeItem(null)}
        onSave={(line) => {
          cart.addCustomizedLine(line);
          setCustomizeItem(null);
        }}
      />
      <PosSelectTableOverlay
        open={selectTableOpen || pickTableAfterPayOpen}
        outletId={outletId ?? ""}
        initialTableId={pickTableAfterPayOpen ? null : selectedTable?.id ?? null}
        busy={saveBusy || assignTableBusy}
        pickOnly={pickTableAfterPayOpen}
        onCancel={() => {
          if (pickTableAfterPayOpen) setPickTableAfterPayOpen(false);
          else setSelectTableOpen(false);
        }}
        onSaveAsBill={() => {
          if (pickTableAfterPayOpen) return;
          void onSaveAsWalkInBill();
        }}
        onContinue={(pick) => {
          if (pickTableAfterPayOpen) {
            void onAssignPayFirstTable(pick);
            return;
          }
          onContinueSelectTable(pick);
        }}
        onResumeSession={(session) => {
          if (pickTableAfterPayOpen) return;
          setSelectTableOpen(false);
          const row: PosBillListRow = {
            session,
            groupName: "",
            waiterName: "",
          };
          onSelectOpenBill(row);
        }}
      />
      <PosNewBillDialog
        open={Boolean(newBillPick)}
        onOpenChange={(open) => {
          if (!open) setNewBillPick(null);
        }}
        tableLabel={newBillPick?.name ?? ""}
        groupLabel={newBillPick?.groupName ?? ""}
        defaultPax={newBillPick?.pax ?? 1}
        maxPax={newBillPick?.maxPax ?? newBillPick?.pax ?? 20}
        waiter={shiftWaiter.waiter}
        waiterLoading={shiftWaiter.isLoading}
        confirming={saveBusy}
        onConfirm={(args) => void onConfirmNewBill(args)}
      />
      <PosBillListDialog
        open={billListOpen}
        onOpenChange={setBillListOpen}
        initialTab={billListTab}
        openRows={billListOpenSessions.rows}
        cancelledRows={billListCancelled.data ?? []}
        paidRows={billListPaid.data ?? []}
        voids={lineVoids.voids}
        nowMs={durationTick}
        refundBusyId={refundBusyId}
        onNewBill={onNewBillFromList}
        onSelectOpen={onSelectOpenBill}
        onCancelOpen={setCancelTarget}
        onFulfillOpen={onFulfillOpenBill}
        onRefundPaid={onRefundPaidBill}
        showFulfillAction={stockCommitPoint === "fulfillment"}
      />
      <PosBillReasonDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t(POS_BILL_LIST_I18N.cancelReasonTitle, "Reason for cancelling bill")}
        onConfirm={confirmCancelBill}
        confirming={reasonBusy}
      />
      <PosBillReasonDialog
        open={Boolean(pendingVoid)}
        onOpenChange={(open) => {
          if (!open) setPendingVoid(null);
        }}
        title={t(POS_BILL_LIST_I18N.voidReasonTitle, "Reason for cancelling product")}
        onConfirm={confirmProductVoid}
        confirming={reasonBusy}
      />
      {pinDialog}
    </div>
  );
}
