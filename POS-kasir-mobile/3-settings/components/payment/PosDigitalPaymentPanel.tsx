import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosQrisEligibility } from "@/shared/pos-qris/hooks/usePosQrisEligibility";
import { usePaymentMethodChannels } from "@/8-2-10-reports/payment-methods/hooks/usePaymentMethodChannels";
import { PAYMENT_METHOD_CATEGORY_I18N } from "@/8-2-10-reports/payment-methods/lib/paymentMethodCategoryLabels";
import { readPosSelectedOutletId } from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
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
    <div className="space-y-4 px-4 py-4 pb-8">
      <div className="rounded-md bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
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
        <div>
          <div className="mb-1 flex items-center gap-3 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t(POS_SETTINGS_I18N.paymentDigitalSection, "Digital (Xendit)")}
            </p>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="rounded-md border border-slate-100 bg-white">
            {isLoading ? (
              <div className="flex items-center gap-3 px-4 py-3.5" aria-hidden>
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

      <div>
        <div className="mb-1 flex items-center gap-3 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {t(POS_SETTINGS_I18N.paymentActiveMethods, "At cashier (this outlet)")}
          </p>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <p className="mb-2 text-xs leading-relaxed text-slate-500">
          {t(
            POS_SETTINGS_I18N.paymentActiveMethodsHint,
            "Payment methods enabled for this outlet in back office. Manage them there — not from POS.",
          )}
        </p>
        <div className="rounded-md border border-slate-100 bg-white">
          {isLoading ? (
            <>
              <div
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5"
                aria-hidden
              >
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3.5" aria-hidden>
                <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
              </div>
            </>
          ) : cashierMethods.length === 0 ? (
            <p className="px-4 py-3.5 text-sm text-slate-500">
              {t(
                POS_SETTINGS_I18N.paymentActiveMethodsEmpty,
                "No other payment methods enabled for this outlet in back office.",
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
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm text-slate-600">
          {t(
            POS_SETTINGS_I18N.paymentEmptyState,
            "No payment methods are enabled yet. Configure them in back office.",
          )}
        </p>
      ) : null}
    </div>
  );
}
