import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { PosCashierMenuDrawer } from "@/pos-mobile/2-cashier/components/PosCashierMenuDrawer";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSettingsShell } from "@/pos-mobile/3-settings/components/PosSettingsShell";
import { PosShiftCashMovementPanel } from "../components/PosShiftCashMovementPanel";
import { PosShiftCurrentPanel } from "../components/PosShiftCurrentPanel";
import { PosShiftHero } from "../components/PosShiftHero";
import { PosShiftHistoryDetailPanel } from "../components/PosShiftHistoryDetailPanel";
import { PosShiftHistoryPanel } from "../components/PosShiftHistoryPanel";
import { PosShiftNav } from "../components/PosShiftNav";
import { PosShiftOptionsPanel } from "../components/PosShiftOptionsPanel";
import { PosShiftProductsSoldPanel } from "../components/PosShiftProductsSoldPanel";
import { POS_SHIFT_I18N } from "../lib/posShiftCopy";
import {
  getPosShiftNavItem,
  isPosShiftHistoryNested,
  parsePosShiftSection,
  type PosShiftSectionId,
} from "../lib/posShiftSections";
import type { PosCashierShift } from "../lib/posShiftTypes";
import {
  usePosCashMovements,
  usePosOpenShift,
  usePosShiftHistory,
} from "../lib/usePosCashierShift";
import { usePosShiftCashierName } from "../lib/usePosShiftCashierName";
import { usePosOutletShiftSettings } from "../lib/usePosOutletShiftSettings";
import { PosShiftSkeleton } from "./PosShiftSkeleton";

/**
 * Synckerja POS Shift — master–detail tablet screen.
 * Authenticated route: `/pos/shift`.
 */
export default function PosShiftPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { t } = useAppTranslation();
  const { user } = useAuth();
  const { loading: orgLoading } = useCentralizedUserData();
  const permissions = usePosAppPermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const [outletName] = useState(() => outletMeta?.name || outletId || "");

  const section = parsePosShiftSection(searchParams.get("section"));
  const historyShiftId = searchParams.get("shiftId");
  const navItem = getPosShiftNavItem(section);

  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = usePosOutletShiftSettings(outletId);
  const openShift = usePosOpenShift(outletId);
  const historyQuery = usePosShiftHistory(outletId);

  const historyShift: PosCashierShift | null = useMemo(() => {
    if (!historyShiftId) return null;
    return (historyQuery.data ?? []).find((r) => r.id === historyShiftId) ?? null;
  }, [historyQuery.data, historyShiftId]);

  const cashierUserId = useMemo(() => {
    if (isPosShiftHistoryNested(section) && historyShift?.opened_by) {
      return historyShift.opened_by;
    }
    return openShift.data?.opened_by ?? user?.id ?? null;
  }, [section, historyShift?.opened_by, openShift.data?.opened_by, user?.id]);

  const emailFallback =
    cashierUserId && user?.id && cashierUserId === user.id ? user.email : null;
  const cashierName = usePosShiftCashierName(cashierUserId, emailFallback);

  const cashIoShiftId =
    section === "cash-io"
      ? (openShift.data?.id ?? null)
      : section === "history-cash-io"
        ? historyShiftId
        : null;
  const movements = usePosCashMovements(cashIoShiftId);

  const setSection = useCallback(
    (id: PosShiftSectionId, shiftId?: string | null) => {
      const next: Record<string, string> = {};
      if (id !== "options") next.section = id;
      if (shiftId) next.shiftId = shiftId;
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (section !== "cash-io" && section !== "products-sold") return;
    if (openShift.isLoading) return;
    if (!openShift.data) setSection("current");
  }, [section, openShift.isLoading, openShift.data, setSection]);

  useEffect(() => {
    if (!isPosShiftHistoryNested(section)) return;
    if (!historyShiftId) {
      setSection("history");
      return;
    }
    if (historyQuery.isLoading || historyQuery.isFetching) return;
    if (!historyShift) setSection("history");
  }, [
    section,
    historyShiftId,
    historyShift,
    historyQuery.isLoading,
    historyQuery.isFetching,
    setSection,
  ]);

  const rightHeader = useMemo(() => {
    if (section === "cash-io" || section === "history-cash-io") {
      return t(POS_SHIFT_I18N.cashIoTitle, "Cash Out / Cash In");
    }
    if (section === "products-sold" || section === "history-products-sold") {
      return t(POS_SHIFT_I18N.productsSoldTitle, "Products Sold");
    }
    if (section === "history-detail") {
      return t(POS_SHIFT_I18N.historyDetailTitle, "Shift Detail");
    }
    if (section === "options") {
      return t(POS_SHIFT_I18N.optionsTitle, "Automatic Shift");
    }
    return t(navItem.panelTitleKey, navItem.panelTitleFallback);
  }, [section, navItem, t]);

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (orgLoading && !user) {
    return <PosShiftSkeleton />;
  }

  if (permissions.isLoading) {
    return <PosShiftSkeleton />;
  }

  if (!permissions.canViewShift()) {
    return (
      <Navigate
        to={resolvePosPostOutletPath({
          canCharge: permissions.canCharge(),
          canKitchenDisplay: permissions.canKitchenDisplay(),
        })}
        replace
      />
    );
  }

  const displayName = cashierName.name;

  const isNestedDetail =
    section === "cash-io" ||
    section === "products-sold" ||
    isPosShiftHistoryNested(section);

  return (
    <>
      <PosSettingsShell
        leftHeader={t(POS_SHIFT_I18N.title, "Shift")}
        rightHeader={rightHeader}
        hideRightHeader={isNestedDetail}
        left={
          <>
            <PosShiftHero />
            <PosShiftNav
              activeId={section}
              onSelect={(id) => setSection(id)}
              autoStartEnabled={Boolean(settings?.auto_start_enabled)}
            />
          </>
        }
        right={
          section === "options" ? (
            <PosShiftOptionsPanel outletId={outletId} />
          ) : section === "history" ? (
            <PosShiftHistoryPanel
              rows={historyQuery.data ?? []}
              isLoading={historyQuery.isLoading || historyQuery.isFetching}
              isError={historyQuery.isError}
              onRetry={() => void historyQuery.refetch()}
              onSelectShift={(row) => setSection("history-detail", row.id)}
            />
          ) : section === "history-detail" && historyShift ? (
            <PosShiftHistoryDetailPanel
              shift={historyShift}
              outletId={outletId}
              outletName={outletName}
              displayName={displayName}
              onBack={() => setSection("history")}
              onOpenCashIo={() => setSection("history-cash-io", historyShift.id)}
              onOpenProductsSold={() =>
                setSection("history-products-sold", historyShift.id)
              }
            />
          ) : section === "history-cash-io" && historyShiftId ? (
            <PosShiftCashMovementPanel
              shiftId={historyShiftId}
              outletId={outletId}
              movements={movements.data ?? []}
              readOnly
              onBack={() => setSection("history-detail", historyShiftId)}
            />
          ) : section === "history-products-sold" && historyShiftId ? (
            <PosShiftProductsSoldPanel
              shiftId={historyShiftId}
              onBack={() => setSection("history-detail", historyShiftId)}
            />
          ) : section === "cash-io" && openShift.data ? (
            <PosShiftCashMovementPanel
              shiftId={openShift.data.id}
              outletId={outletId}
              movements={movements.data ?? []}
              onBack={() => setSection("current")}
            />
          ) : section === "products-sold" && openShift.data ? (
            <PosShiftProductsSoldPanel
              shiftId={openShift.data.id}
              onBack={() => setSection("current")}
            />
          ) : (
            <PosShiftCurrentPanel
              outletId={outletId}
              outletName={outletName}
              displayName={displayName}
              onOpenCashIo={() => setSection("cash-io")}
              onOpenProductsSold={() => setSection("products-sold")}
            />
          )
        }
        footer={
          <PosAppFooterBar
            outletLabel={outletName}
            onOpenMenu={() => setMenuOpen(true)}
            menuAriaLabel={t(POS_SHIFT_I18N.menu, "Menu")}
          />
        }
      />

      <PosCashierMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        outletName={outletName}
        activeId="shift"
      />
    </>
  );
}
