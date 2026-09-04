import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath } from "@/pos-mobile/shared/access";
import { PosKitchenBoard } from "../components/PosKitchenBoard";
import { PosKitchenSidebar } from "../components/sidebar/PosKitchenSidebar";
import { usePosKitchenCompletedTodayTickets } from "../hooks/usePosKitchenCompletedTodayCount";
import { usePosKitchenRecallTickets } from "../hooks/usePosKitchenRecallTickets";
import { usePosKitchenTickets } from "../hooks/usePosKitchenTickets";
import {
  DEFAULT_KITCHEN_BOARD_MODE,
  type KitchenBoardMode,
} from "../lib/kitchenBoardMode";
import { countTicketsBySalesTypeBucket } from "../lib/kitchenSalesTypeBucket";
import { filterKitchenBoardTickets } from "../lib/filterKitchenBoardTickets";
import type { KitchenSalesTypeBucket } from "../lib/kitchenSalesTypeBucket";
import { selectKitchenCompletedHistoryTickets } from "../lib/partitionKitchenDoneBoards";
import { POS_KITCHEN_I18N } from "../lib/posKitchenCopy";
import { PosKitchenSettingsOverlay } from "../settings/components/PosKitchenSettingsOverlay";
import { usePosKitchenOutletSettings } from "../settings/hooks/usePosKitchenOutletSettings";
import {
  DEFAULT_KITCHEN_DISPLAY_MODE,
  DEFAULT_KITCHEN_FONT_SIZE,
  DEFAULT_KITCHEN_THEME_COLORS,
  DEFAULT_ORDER_TYPE_VISIBILITY,
} from "../settings/lib/posKitchenSettingsTypes";
import { kitchenFontScale } from "../settings/lib/kitchenFontScale";
import { PosKitchenPageSkeleton } from "./PosKitchenPageSkeleton";

/**
 * Kitchen Display board for staff with `app.kitchen_display`.
 * Authenticated route: `/pos/kitchen`.
 * Phone: bottom horizontal nav + top safe-area; tablet: left rail.
 */
export default function PosKitchenPage() {
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  usePosTabletShell({ phoneOverlay: isPhoneLayout });
  useMarkPosAuthSurface();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const permissions = usePosAppPermissions();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<KitchenBoardMode>(DEFAULT_KITCHEN_BOARD_MODE);

  const outletId = readPosSelectedOutletId();
  const outletMeta = readPosSelectedOutlet();
  const outletName = outletMeta?.name || outletId || "";

  const ticketsQuery = usePosKitchenTickets(outletId);
  const recallQuery = usePosKitchenRecallTickets(outletId);
  const completedQuery = usePosKitchenCompletedTodayTickets(outletId);
  const settingsQuery = usePosKitchenOutletSettings(outletId);

  const activeTickets = ticketsQuery.data ?? [];
  const recallTickets = recallQuery.data ?? [];
  /** History for today excluding the short Recall stack (no badge double-count). */
  const completedTickets = useMemo(
    () =>
      selectKitchenCompletedHistoryTickets(
        completedQuery.data ?? [],
        recallTickets,
      ),
    [completedQuery.data, recallTickets],
  );

  const orderTypeVisibility =
    settingsQuery.data?.order_type_visibility ?? DEFAULT_ORDER_TYPE_VISIBILITY;
  const displayMode =
    settingsQuery.data?.display_mode ?? DEFAULT_KITCHEN_DISPLAY_MODE;
  const themeColors =
    settingsQuery.data?.colors ?? DEFAULT_KITCHEN_THEME_COLORS;
  const fontScale = kitchenFontScale(
    settingsQuery.data?.font_size ?? DEFAULT_KITCHEN_FONT_SIZE,
  );

  const bucketCounts = useMemo(
    () => countTicketsBySalesTypeBucket(activeTickets),
    [activeTickets],
  );
  const heldCount = useMemo(
    () => activeTickets.filter((t) => t.is_held).length,
    [activeTickets],
  );

  const boardTickets = useMemo(
    () =>
      filterKitchenBoardTickets({
        mode,
        active: activeTickets,
        recall: recallTickets,
        completedToday: completedTickets,
      }),
    [mode, activeTickets, recallTickets, completedTickets],
  );

  // If current bucket filter was hidden in settings, reset to OPEN.
  useEffect(() => {
    if (mode.kind !== "active" || mode.salesType === "all") return;
    if (orderTypeVisibility[mode.salesType] === false) {
      setMode({ kind: "active", salesType: "all" });
    }
  }, [mode, orderTypeVisibility]);

  const onSelectBucket = useCallback((bucket: KitchenSalesTypeBucket) => {
    setMode((prev) => {
      if (prev.kind === "active" && prev.salesType === bucket) {
        return { kind: "active", salesType: "all" };
      }
      return { kind: "active", salesType: bucket };
    });
  }, []);

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (permissions.isLoading) {
    return <PosKitchenPageSkeleton />;
  }

  // Cashier (and any role) without `app.kitchen_display` cannot stay on KDS.
  if (!permissions.canKitchenDisplay()) {
    return (
      <Navigate
        to={resolvePosPostOutletPath({
          canCharge: permissions.canCharge(),
          canKitchenDisplay: false,
        })}
        replace
      />
    );
  }

  if (ticketsQuery.isLoading && !ticketsQuery.data) {
    return <PosKitchenPageSkeleton />;
  }

  const navProps = {
    mode,
    openCount: activeTickets.length,
    completedCount: completedTickets.length,
    bucketCounts,
    recallCount: recallTickets.length,
    heldCount,
    orderTypeVisibility,
    showBackToPos: permissions.canCharge(),
    onSelectOpen: () => setMode({ kind: "active", salesType: "all" as const }),
    onSelectBucket,
    onSelectRecall: () => setMode({ kind: "recall" }),
    onSelectHeld: () => setMode({ kind: "held" }),
    onSelectCompleted: () => setMode({ kind: "completed_today" }),
    onOpenSettings: () => setSettingsOpen(true),
    onBackToPos: () => navigate(POS_AUTH_PATHS.cashier),
  };

  const board = (
    <PosKitchenBoard
      outletId={outletId}
      tickets={boardTickets}
      displayMode={displayMode}
      themeColors={themeColors}
      fontScale={fontScale}
      readOnly={mode.kind === "completed_today" || mode.kind === "recall"}
      showRecall={mode.kind === "recall" || mode.kind === "completed_today"}
      emptyMessage={
        mode.kind === "recall"
          ? t(
              POS_KITCHEN_I18N.emptyRecall,
              "No recently finished tickets to recall.",
            )
          : mode.kind === "completed_today"
            ? t(
                POS_KITCHEN_I18N.emptyCompleted,
                "No completed tickets in history yet.",
              )
            : undefined
      }
    />
  );

  return (
    <div
      className={cn(
        "relative flex h-[100dvh] overflow-hidden bg-slate-100",
        isPhoneLayout ? "flex-col bg-white" : "flex-row",
      )}
    >
      {isPhoneLayout ? <PosSafeAreaTopSpacer /> : null}

      {isPhoneLayout ? null : <PosKitchenSidebar {...navProps} layout="rail" />}

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col",
          isPhoneLayout && "bg-slate-100",
        )}
      >
        {board}
      </div>

      {isPhoneLayout ? (
        <PosKitchenSidebar {...navProps} layout="bottom" />
      ) : null}

      {settingsOpen ? (
        <PosKitchenSettingsOverlay
          outletId={outletId}
          outletName={outletName}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
