import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { PosCashierMenuDrawer } from "@/pos-mobile/2-cashier/components/PosCashierMenuDrawer";
import { sendPosDigitalReceipt } from "@/pos-mobile/2-cashier/lib/sendPosDigitalReceipt";
import { usePosCheckoutRefund } from "@/pos-mobile/2-cashier/hooks/usePosCheckoutRefund";
import { usePosRefundStockPolicy } from "@/pos-mobile/2-cashier/hooks/usePosRefundStockPolicy";
import {
  POS_REFUND_I18N,
  POS_REFUND_WASTE_REASON_REQUIRED,
  posRefundSuccessTitleKey,
} from "@/pos-mobile/2-cashier/lib/refund";
import { usePosOpenShift } from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import { usePosPinGate } from "@/pos-mobile/shared/hooks/usePosPinGate";
import { POS_PIN_FEATURES } from "@/pos-mobile/shared/lib/posPinFeatures";
import { useCatalogSalesTypes } from "@/8-2-1-default-prices/sales-types/hooks/useCatalogSalesTypes";
import { formatCatalogCheckoutLineLabel } from "@/8-2-1-default-prices/checkout/lib/formatCatalogCheckoutLineLabel";
import { useStoreCheckoutPricing } from "@/5-2-customer-visits/checkout/hooks/useStoreCheckoutPricing";
import { PosActivityDetailPane } from "../components/PosActivityDetailPane";
import { PosActivityListPane } from "../components/PosActivityListPane";
import {
  PosActivityPhonePaneSlider,
} from "../components/phone";
import { PosActivityRefundDialog } from "../components/PosActivityRefundDialog";
import { PosActivitySendReceiptDialog } from "../components/PosActivitySendReceiptDialog";
import { PosActivityShell } from "../components/PosActivityShell";
import { usePosActivityPhoneLayout } from "../hooks/usePosActivityPhoneLayout";
import { filterPosActivityRows } from "../lib/filterPosActivityRows";
import { groupPosActivitiesByDate } from "../lib/groupPosActivitiesByDate";
import type { PosActivityApplicationMethod } from "../lib/computePosActivityDisplayTotals";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import {
  POS_ACTIVITY_QUERY_KEY,
  type PosActivityListRow,
} from "../lib/posActivityTypes";
import {
  resolvePosActivitySessionId,
  usePosActivityCartSnapshot,
  usePosActivityDetail,
  usePosOutletActivities,
} from "../lib/usePosOutletActivities";
import { PosActivityPageSkeleton } from "./PosActivityPageSkeleton";

/**
 * Synckerja POS Activity — master–detail sales history for the selected outlet.
 * Authenticated route: `/pos/activity`.
 */
export default function PosActivityPage() {
  const { isPhoneLayout, pane, setPane, showDetail, showList } =
    usePosActivityPhoneLayout();
  usePosTabletShell({ phoneOverlay: isPhoneLayout });
  useMarkPosAuthSurface();
  const { t, language } = useAppTranslation();
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const permissions = usePosAppPermissions();

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const outletName = outletMeta?.name || outletId || "";

  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSessionId, setRefundSessionId] = useState<string | null | undefined>(
    undefined,
  );
  const [sending, setSending] = useState(false);

  const { runWithPin, pinDialog } = usePosPinGate(outletId);
  const checkoutRefund = usePosCheckoutRefund();
  const refundPolicyQuery = usePosRefundStockPolicy(
    refundSessionId,
    refundOpen && refundSessionId !== undefined,
  );
  const openShiftQuery = usePosOpenShift(outletId);

  const listQuery = usePosOutletActivities(outletId);
  const detailQuery = usePosActivityDetail(selectedId);
  const cartSnapshotQuery = usePosActivityCartSnapshot(selectedId);
  const salesTypesQuery = useCatalogSalesTypes();
  const pricing = useStoreCheckoutPricing(
    outletId,
    detailQuery.data?.catalog_sales_type_id ?? null,
  );

  const salesTypeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of salesTypesQuery.rows ?? []) {
      map.set(row.id, (row.name ?? "").trim() || row.id);
    }
    return map;
  }, [salesTypesQuery.rows]);

  const applicationMethod: PosActivityApplicationMethod =
    pricing.settings?.application_method === "include" ? "include" : "add";

  const locale = typeof language === "string" ? language : "id";

  const taxLabel = useMemo(() => {
    const primary = pricing.outletTaxes[0];
    if (!primary) return t(POS_ACTIVITY_I18N.tax, "Tax");
    return formatCatalogCheckoutLineLabel({
      name: primary.name,
      amountPercent: primary.amount_percent,
      locale,
    });
  }, [locale, pricing.outletTaxes, t]);

  const gratuityLabel = useMemo(() => {
    const primary = pricing.outletGratuities[0];
    if (!primary) return t(POS_ACTIVITY_I18N.gratuity, "Gratuity");
    return formatCatalogCheckoutLineLabel({
      name: primary.name,
      amountPercent: primary.amount_percent,
      locale,
    });
  }, [locale, pricing.outletGratuities, t]);

  const allRows = useMemo(() => {
    return (listQuery.data?.pages ?? []).flatMap((p) => p.rows);
  }, [listQuery.data?.pages]);

  const filteredRows = useMemo(
    () => filterPosActivityRows(allRows, search),
    [allRows, search],
  );

  const groups = useMemo(
    () => groupPosActivitiesByDate(filteredRows),
    [filteredRows],
  );

  useEffect(() => {
    if (filteredRows.length === 0) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredRows.some((r) => r.id === selectedId)) {
      setSelectedId(filteredRows[0].id);
    }
  }, [filteredRows, selectedId]);

  useEffect(() => {
    if (!refundOpen || !organizationId || !selectedId) return;
    let cancelled = false;
    setRefundSessionId(undefined);
    void resolvePosActivitySessionId(organizationId, selectedId)
      .then((sessionId) => {
        if (!cancelled) setRefundSessionId(sessionId);
      })
      .catch((err) => {
        if (cancelled) return;
        setRefundOpen(false);
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: t(POS_ACTIVITY_I18N.refundError, "Failed to refund checkout stock"),
          description: message,
          variant: "destructive",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [refundOpen, organizationId, selectedId, t, toast]);

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (permissions.isLoading) {
    return <PosActivityPageSkeleton />;
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

  if (listQuery.isLoading && allRows.length === 0) {
    return <PosActivityPageSkeleton />;
  }

  const emptyLabel = search.trim()
    ? t(POS_ACTIVITY_I18N.emptySearch, "No matching transactions.")
    : t(POS_ACTIVITY_I18N.empty, "No sales yet for this outlet.");

  const canSend =
    permissions.unrestricted || permissions.canResendReceipt();
  const canRefund = permissions.unrestricted || permissions.canRefund();

  const onSelect = (row: PosActivityListRow) => {
    setSelectedId(row.id);
    if (isPhoneLayout) showDetail();
  };

  const onSendReceipt = () => {
    if (!canSend) {
      toast({
        title: t(
          POS_ACTIVITY_I18N.sendNoPermission,
          "You do not have permission to resend receipts.",
        ),
        variant: "destructive",
      });
      return;
    }
    const detail = detailQuery.data;
    if (!detail?.lead_id) {
      toast({
        title: t(
          POS_ACTIVITY_I18N.noLead,
          "This transaction has no customer lead for digital receipt.",
        ),
        variant: "destructive",
      });
      return;
    }
    runWithPin(POS_PIN_FEATURES.resendReceipts, () => setSendOpen(true));
  };

  const onSelectRefund = () => {
    if (!canRefund) {
      toast({
        title: t(
          POS_ACTIVITY_I18N.refundNoPermission,
          "You do not have permission to issue refunds.",
        ),
        variant: "destructive",
      });
      return;
    }
    runWithPin(POS_PIN_FEATURES.issueRefunds, () => {
      setRefundSessionId(undefined);
      setRefundOpen(true);
    });
  };

  const confirmSend = async (payload: {
    channel: "email" | "sms";
    email: string;
    phoneLocal: string;
    customerName: string;
  }) => {
    const detail = detailQuery.data;
    if (!organizationId || !outletId || !detail?.lead_id) return;
    setSending(true);
    try {
      const result = await sendPosDigitalReceipt({
        organizationId,
        outletId,
        salesActivityId: detail.id,
        leadId: detail.lead_id,
        clientName: payload.customerName || detail.client_name,
        channel: payload.channel,
        email: payload.email,
        phoneLocal: payload.phoneLocal,
        createdByUserId: user?.id ?? null,
      });
      if (!result.ok) {
        const title =
          result.code === "share_disabled"
            ? payload.channel === "email"
              ? t(
                  POS_ACTIVITY_I18N.shareEmailOff,
                  "Email receipt is disabled in outlet receipt settings.",
                )
              : t(
                  POS_ACTIVITY_I18N.shareSmsOff,
                  "SMS receipt is disabled in outlet receipt settings.",
                )
            : result.code === "invalid_email"
              ? t(POS_ACTIVITY_I18N.invalidEmail, "Enter a valid email address")
              : result.code === "invalid_phone"
                ? t(POS_ACTIVITY_I18N.invalidPhone, "Enter a valid phone number")
                : t(POS_ACTIVITY_I18N.sendError, "Failed to send receipt");
        toast({ title, variant: "destructive" });
        return;
      }
      toast({ title: t(POS_ACTIVITY_I18N.sendSuccess, "Receipt sent") });
      setSendOpen(false);
    } finally {
      setSending(false);
    }
  };

  const confirmRefund = (reason: string | null) => {
    const detail = detailQuery.data;
    if (!organizationId || !outletId || !detail) return;
    void (async () => {
      try {
        const result = await checkoutRefund.mutateAsync({
          activityId: detail.id,
          sessionId: refundSessionId,
          outletId,
          shiftId: openShiftQuery.data?.id ?? null,
          reason,
        });
        const policy = result.effectiveStockPolicy;
        toast({
          title: t(
            posRefundSuccessTitleKey(policy),
            policy === "waste"
              ? "Sale refunded · stock not restored"
              : "Sale refunded · stock restored",
          ),
        });
        if (result.kitchenVoidError) {
          toast({
            title: t(
              POS_REFUND_I18N.kitchenVoidWarning,
              "Sale refunded, but kitchen tickets could not be voided.",
            ),
            description: result.kitchenVoidError,
            variant: "destructive",
          });
        }
        setRefundOpen(false);
        setRefundSessionId(undefined);
        setSelectedId(null);
        if (isPhoneLayout) showList();
        await queryClient.invalidateQueries({
          queryKey: [POS_ACTIVITY_QUERY_KEY],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast({
          title: t(POS_ACTIVITY_I18N.refundError, "Failed to refund checkout stock"),
          description:
            message === POS_REFUND_WASTE_REASON_REQUIRED
              ? t(
                  POS_REFUND_I18N.policyChangedNeedReason,
                  "Kitchen started this order. Enter a reason and try again.",
                )
              : message,
          variant: "destructive",
        });
      }
    })();
  };

  const listPane = (
    <PosActivityListPane
      search={search}
      onSearchChange={setSearch}
      groups={groups}
      selectedId={selectedId}
      onSelect={onSelect}
      hasNextPage={Boolean(listQuery.hasNextPage)}
      isFetchingNextPage={listQuery.isFetchingNextPage}
      onLoadMore={() => void listQuery.fetchNextPage()}
      emptyLabel={emptyLabel}
      fullWidth={isPhoneLayout}
    />
  );

  const detailPane = (
    <PosActivityDetailPane
      detail={detailQuery.data ?? null}
      loading={Boolean(selectedId) && detailQuery.isLoading}
      canSend={canSend}
      canRefund={canRefund}
      refundBusy={checkoutRefund.isPending}
      cartSnapshot={cartSnapshotQuery.data ?? null}
      salesTypeNameById={salesTypeNameById}
      applicationMethod={applicationMethod}
      taxLabel={taxLabel}
      gratuityLabel={gratuityLabel}
      onSendReceipt={onSendReceipt}
      onSelectRefund={onSelectRefund}
    />
  );

  return (
    <>
      <PosActivityShell
        title={t(POS_ACTIVITY_I18N.title, "Activity")}
        outletLabel={outletName}
        menuAriaLabel={t(POS_ACTIVITY_I18N.menu, "Menu")}
        onOpenMenu={() => setMenuOpen(true)}
        isPhoneLayout={isPhoneLayout}
      >
        {isPhoneLayout ? (
          <PosActivityPhonePaneSlider
            pane={pane}
            onPaneChange={setPane}
            list={listPane}
            detail={detailPane}
          />
        ) : (
          <>
            {listPane}
            {detailPane}
          </>
        )}
      </PosActivityShell>

      <PosCashierMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        outletName={outletName}
        activeId="activity"
      />

      <PosActivitySendReceiptDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        defaultCustomerName={detailQuery.data?.client_name}
        defaultPhone={detailQuery.data?.client_phone}
        busy={sending}
        onSend={(payload) => void confirmSend(payload)}
      />

      <PosActivityRefundDialog
        open={refundOpen}
        onOpenChange={(open) => {
          setRefundOpen(open);
          if (!open) setRefundSessionId(undefined);
        }}
        busy={checkoutRefund.isPending}
        policyLoading={
          refundOpen &&
          (refundSessionId === undefined || refundPolicyQuery.isLoading)
        }
        policy={refundPolicyQuery.data ?? null}
        policyError={
          refundPolicyQuery.error instanceof Error
            ? refundPolicyQuery.error.message
            : refundPolicyQuery.isError
              ? t(POS_ACTIVITY_I18N.refundError, "Failed to refund checkout stock")
              : null
        }
        onConfirm={confirmRefund}
      />

      {pinDialog}
    </>
  );
}
