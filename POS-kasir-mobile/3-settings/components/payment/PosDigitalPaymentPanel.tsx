import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosQrisEligibility } from "@/shared/pos-qris/hooks/usePosQrisEligibility";
import { usePaymentMethodChannels } from "@/8-2-10-reports/payment-methods/hooks/usePaymentMethodChannels";
import { PAYMENT_METHOD_CATEGORY_I18N } from "@/8-2-10-reports/payment-methods/lib/paymentMethodCategoryLabels";
import { cn } from "@/shared/lib/utils";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import {
  POS_PAYMENT_TERMS_HREF,
  POS_SETTINGS_I18N,
} from "../../lib/posSettingsCopy";
import { PosPaymentMethodStatusRow } from "./PosPaymentMethodStatusRow";

/**
 * Digital payment settings — read-only view of BO-configured methods (no Xendit CTA).
 */
export function PosDigitalPaymentPanel() {
  const { t } = useAppTranslation();
  const outletId = readPosSelectedOutletId();

  const eligibility = usePosQrisEligibility(outletId);
  const channelsQuery = usePaymentMethodChannels({
    outletId: outletId ?? "",
    enabled: Boolean(outletId),
  });

  /** Only methods already enabled for this outlet in back office. */
  const cashierMethods = channelsQuery.channels.filter(
    (ch) => ch.isActive && ch.slug !== "qris" && ch.category !== "qris",
  );

  const isLoading = eligibility.isLoading || channelsQuery.isLoading;
  const showQris = !isLoading && eligibility.isEligible;
  const showEmpty =
    !isLoading && !eligibility.isEligible && cashierMethods.length === 0;

  return (
    <div className={POS_PANEL.body}>
      <div className={cn(POS_PANEL.card, "bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-600")}>
        {t(POS_SETTINGS_I18N.paymentTermsBefore, "We have updated the")}{" "}
        <a
          href={POS_PAYMENT_TERMS_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          {t(POS_SETTINGS_I18N.paymentTermsLink, "Terms and Conditions")}
        </a>{" "}
        {t(POS_SETTINGS_I18N.paymentTermsAfter, "for digital payments.")}
      </div>

      {isLoading || showQris ? (
        <div className="mt-3">
          <p className={POS_PANEL.sectionTitle}>
            {t(POS_SETTINGS_I18N.paymentDigitalSection, "Digital (Xendit)")}
          </p>
          <div className={POS_PANEL.card}>
            {isLoading ? (
              <div className={cn(POS_PANEL.row, "gap-3")} aria-hidden>
                <div className="h-9 w-9 animate-pulse rounded bg-slate-100" />
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <PosPaymentMethodStatusRow
                title={t(POS_SETTINGS_I18N.paymentQrisName, "QRIS")}
                statusLabel={t(
                  POS_SETTINGS_I18N.paymentQrisStatusReady,
                  "Ready",
                )}
                tone="success"
                leading={
                  <img
                    src="/qris1.png"
                    alt=""
                    className="h-8 w-8 object-contain"
                  />
                }
                trailingExtra={
                  eligibility.isSandbox ? (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      {t(POS_SETTINGS_I18N.paymentSandboxBadge, "Sandbox")}
                    </span>
                  ) : null
                }
              />
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <p className={POS_PANEL.sectionTitle}>
          {t(POS_SETTINGS_I18N.paymentActiveMethods, "At cashier (this outlet)")}
        </p>
        <p className="mb-2 px-0.5 text-xs leading-relaxed text-slate-500">
          {t(
            POS_SETTINGS_I18N.paymentActiveMethodsHint,
            "Managed in back office, not from POS.",
          )}
        </p>
        <div className={POS_PANEL.card}>
          {isLoading ? (
            <>
              <div className={cn(POS_PANEL.row, "gap-3")} aria-hidden>
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
              </div>
              <div className={cn(POS_PANEL.row, "gap-3")} aria-hidden>
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
              </div>
            </>
          ) : cashierMethods.length === 0 ? (
            <p className="px-3 py-3.5 text-sm text-slate-500">
              {t(
                POS_SETTINGS_I18N.paymentActiveMethodsEmpty,
                "None enabled in back office.",
              )}
            </p>
          ) : (
            cashierMethods.map((ch) => {
              const cat = PAYMENT_METHOD_CATEGORY_I18N[ch.category];
              const categoryLabel = t(cat.key, cat.fallback);
              return (
                <PosPaymentMethodStatusRow
                  key={ch.id}
                  title={ch.name}
                  statusLabel={categoryLabel}
                  tone="neutral"
                />
              );
            })
          )}
        </div>
      </div>

      {showEmpty ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-600">
          {t(
            POS_SETTINGS_I18N.paymentEmptyState,
            "None yet — set up in back office.",
          )}
        </p>
      ) : null}
    </div>
  );
}
