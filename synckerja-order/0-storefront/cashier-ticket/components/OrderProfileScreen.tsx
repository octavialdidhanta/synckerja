import { ChevronLeft, ChevronRight, Globe, History, Shield, UserCircle } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { CASHIER_TICKET_I18N } from "../lib/cashierTicketCopy";

const ACCENT = "#F97316";

export function OrderProfileScreen({
  onBack,
  onOrderHistory,
  onLanguage,
  languageLabel,
}: {
  onBack: () => void;
  onOrderHistory: () => void;
  onLanguage: () => void;
  languageLabel?: string;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-100">
      <div className={`flex shrink-0 items-center gap-2 bg-white ${ORDER_STOREFRONT_PX} py-3`}>
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center text-neutral-800"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </button>
        <h1 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-neutral-900">
          {t(CASHIER_TICKET_I18N.profileTitle, "Profile")}
        </h1>
        <span className="h-8 w-8" aria-hidden />
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto ${ORDER_STOREFRONT_PX} py-4`}>
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
            <UserCircle className="h-10 w-10" strokeWidth={1.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-900">
              {t(CASHIER_TICKET_I18N.loginGuest, "Log In as Guest")}
            </p>
            <button
              type="button"
              disabled
              className="mt-2 w-full rounded-lg py-2.5 text-[14px] font-semibold text-white disabled:opacity-90"
              style={{ backgroundColor: ACCENT }}
              title={t(CASHIER_TICKET_I18N.signInSoon, "Coming soon")}
            >
              {t(CASHIER_TICKET_I18N.signIn, "Sign In")}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onOrderHistory}
            className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm"
          >
            <History className="h-5 w-5 text-neutral-700" />
            <span className="flex-1 text-[14px] font-medium text-neutral-900">
              {t(CASHIER_TICKET_I18N.orderHistory, "Order History")}
            </span>
            <ChevronRight className="h-5 w-5 text-neutral-400" />
          </button>
          <button
            type="button"
            onClick={onLanguage}
            className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3.5 text-left shadow-sm"
          >
            <Globe className="h-5 w-5 text-neutral-700" />
            <span className="flex-1 text-[14px] font-medium text-neutral-900">
              {t(CASHIER_TICKET_I18N.language, "Language")}
            </span>
            {languageLabel ? (
              <span className="text-[12px] text-neutral-500">{languageLabel}</span>
            ) : null}
            <ChevronRight className="h-5 w-5 text-neutral-400" />
          </button>
          <div className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3.5 shadow-sm">
            <Shield className="h-5 w-5 text-neutral-700" />
            <span className="flex-1 text-[14px] font-medium text-neutral-900">
              {t(CASHIER_TICKET_I18N.privacyPolicy, "Privacy Policy")}
            </span>
            <ChevronRight className="h-5 w-5 text-neutral-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
