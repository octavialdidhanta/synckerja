import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useCatalogCheckoutSettings } from "@/8-2-1-default-prices/checkout/hooks/useCatalogCheckoutSettings";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { signOutletReceiptLogo } from "@/8-2-6-receipt/lib/receiptLogoStorage";
import { useOutletReceiptSettings } from "@/8-2-6-receipt/hooks/useOutletReceiptSettings";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import {
  readPosSelectedOutlet,
  readPosSelectedOutletId,
  stashPosSelectedOutlet,
} from "@/pos-mobile/1-outlet-select/lib/posSelectedOutletStorage";
import { PosCashierMenuDrawer } from "@/pos-mobile/2-cashier/components/PosCashierMenuDrawer";
import { PosAppFooterBar } from "@/pos-mobile/shared/layout/PosAppFooterBar";
import { PosSessionLeaveProvider } from "@/pos-mobile/shared/PosSessionLeaveProvider";
import { PosNotificationSoundSheet } from "../components/PosNotificationSoundSheet";
import { PosOnlineOrderSettingsPanel } from "../components/PosOnlineOrderSettingsPanel";
import { PosDigitalPaymentPanel } from "../components/payment/PosDigitalPaymentPanel";
import { PosPaymentSettingsPanel } from "../components/payment-settings/PosPaymentSettingsPanel";
import { PosTaxSettingsPanel } from "../components/tax/PosTaxSettingsPanel";
import { PosSurchargeSettingsPanel } from "../components/surcharge/PosSurchargeSettingsPanel";
import { PosHardwareSoonPanel } from "../components/hardware/PosHardwareSoonPanel";
import { PosPrinterSettingsPanel } from "../components/hardware/printer";
import {
  PosLanguageSettingsPanel,
  PosProfileSettingsPanel,
  PosSettingsLogoutButton,
  type PosOutletProfileSaved,
} from "../components/account";
import { PosSettingsNav } from "../components/PosSettingsNav";
import { PosSettingsProfileCard } from "../components/PosSettingsProfileCard";
import { PosSettingsShell } from "../components/PosSettingsShell";
import {
  POS_NOTIFICATION_SOUND_OPTIONS,
  POS_SETTINGS_I18N,
  type PosNotificationSoundId,
} from "../lib/posSettingsCopy";
import {
  getPosSettingsNavItem,
  parsePosSettingsSection,
  type PosSettingsSectionId,
} from "../lib/posSettingsSections";
import {
  readPosDeviceSettings,
  writePosDeviceSettings,
  type PosDeviceSettings,
} from "../lib/posSettingsStorage";
import { PosSettingsSkeleton } from "./PosSettingsSkeleton";

function PosSettingsRightPanel({
  section,
  settings,
  soundLabel,
  onSettingsChange,
  onOpenSoundPicker,
  onNavigateSection,
  onOutletSaved,
}: {
  section: PosSettingsSectionId;
  settings: PosDeviceSettings;
  soundLabel: string;
  onSettingsChange: (next: PosDeviceSettings) => void;
  onOpenSoundPicker: () => void;
  onNavigateSection: (id: PosSettingsSectionId) => void;
  onOutletSaved?: (meta: PosOutletProfileSaved) => void;
}) {
  if (section === "payment") return <PosDigitalPaymentPanel />;
  if (section === "tax") return <PosTaxSettingsPanel />;
  if (section === "surcharge") return <PosSurchargeSettingsPanel />;
  if (section === "payment-settings") {
    return (
      <PosPaymentSettingsPanel
        deviceSettings={settings}
        onDeviceSettingsChange={onSettingsChange}
        onNavigateSection={(id) => onNavigateSection(id)}
      />
    );
  }
  if (section === "printer") return <PosPrinterSettingsPanel />;
  if (section === "language") return <PosLanguageSettingsPanel />;
  if (section === "profile") {
    return <PosProfileSettingsPanel onOutletSaved={onOutletSaved} />;
  }
  if (
    section === "barcode-scanner" ||
    section === "gobiz-edc" ||
    section === "customer-display" ||
    section === "support"
  ) {
    return <PosHardwareSoonPanel />;
  }
  return (
    <PosOnlineOrderSettingsPanel
      settings={settings}
      soundLabel={soundLabel}
      onChange={onSettingsChange}
      onOpenSoundPicker={onOpenSoundPicker}
    />
  );
}

/**
 * Synckerja POS settings — master–detail tablet screen.
 * Authenticated route: `/pos/settings` (outside AdaptiveAppLayout).
 */
export default function PosSettingsPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { t, language } = useAppTranslation();
  const { user } = useAuth();
  const { organizationName, loading: orgLoading } = useCentralizedUserData();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkout = useCatalogCheckoutSettings();
  const { rows: outlets } = usePosOutlets();

  const outletId = readPosSelectedOutletId();
  const selectedOutlet = useMemo(
    () => (outletId ? outlets.find((o) => o.id === outletId) ?? null : null),
    [outletId, outlets],
  );
  const [outletName, setOutletName] = useState(
    () => readPosSelectedOutlet()?.name || outletId || "",
  );
  const [outletAddress, setOutletAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const receipt = useOutletReceiptSettings(outletId);

  useEffect(() => {
    if (!selectedOutlet) return;
    setOutletName(selectedOutlet.name);
    setOutletAddress(selectedOutlet.address?.trim() || "");
  }, [selectedOutlet]);

  useEffect(() => {
    let cancelled = false;
    void signOutletReceiptLogo(receipt.settings?.logo_storage_path).then((url) => {
      if (!cancelled) setLogoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt.settings?.logo_storage_path]);

  const section = parsePosSettingsSection(searchParams.get("section"));
  const navItem = getPosSettingsNavItem(section);

  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [settings, setSettings] = useState<PosDeviceSettings>(() =>
    outletId ? readPosDeviceSettings(outletId) : readPosDeviceSettings("_"),
  );

  const setSection = useCallback(
    (id: PosSettingsSectionId) => {
      setSearchParams(id === "online-orders" ? {} : { section: id }, { replace: true });
    },
    [setSearchParams],
  );

  const persist = useCallback(
    (next: PosDeviceSettings) => {
      setSettings(next);
      if (outletId) writePosDeviceSettings(outletId, next);
    },
    [outletId],
  );

  const onOutletSaved = useCallback((meta: PosOutletProfileSaved) => {
    setOutletName(meta.name);
    setOutletAddress(meta.address);
    const id = readPosSelectedOutletId();
    if (id) {
      stashPosSelectedOutlet({
        id,
        name: meta.name,
        address: meta.address?.trim() || null,
      });
    }
  }, []);

  const soundLabel = useMemo(() => {
    const opt = POS_NOTIFICATION_SOUND_OPTIONS.find(
      (o) => o.id === settings.notificationSoundId,
    );
    return t(opt?.labelKey ?? POS_SETTINGS_I18N.soundTelepathy, opt?.fallback ?? "Telepathy");
  }, [settings.notificationSoundId, t]);

  const statusOverrides = useMemo((): Partial<Record<PosSettingsSectionId, string | null>> => {
    const activeLabel = t(POS_SETTINGS_I18N.statusActive, "Active");
    const langCode = (typeof language === "string" && language.toLowerCase().startsWith("en"))
      ? "EN"
      : "ID";
    return {
      tax: checkout.settings?.tax_enabled ? activeLabel : null,
      surcharge: checkout.settings?.gratuity_enabled ? activeLabel : null,
      language: langCode,
    };
  }, [checkout.settings?.tax_enabled, checkout.settings?.gratuity_enabled, language, t]);

  if (!outletId) {
    return <Navigate to={POS_AUTH_PATHS.selectOutlet} replace />;
  }

  if (orgLoading && !user) {
    return <PosSettingsSkeleton />;
  }

  const displayOutletName = outletName || outletId || "";

  return (
    <PosSessionLeaveProvider>
      <PosSettingsShell
        leftHeader={t(POS_SETTINGS_I18N.title, "Settings")}
        rightHeader={t(navItem.panelTitleKey, navItem.panelTitleFallback)}
        left={
          <>
            <PosSettingsProfileCard
              outletName={displayOutletName}
              email={user?.email ?? null}
              subtitle={organizationName || null}
              address={outletAddress}
              logoUrl={logoUrl}
            />
            <PosSettingsNav
              activeId={section}
              onSelect={setSection}
              statusOverrides={statusOverrides}
            />
          </>
        }
        leftFooter={<PosSettingsLogoutButton />}
        right={
          <PosSettingsRightPanel
            section={section}
            settings={settings}
            soundLabel={soundLabel}
            onSettingsChange={persist}
            onOpenSoundPicker={() => setSoundOpen(true)}
            onNavigateSection={setSection}
            onOutletSaved={onOutletSaved}
          />
        }
        footer={
          <PosAppFooterBar
            outletLabel={displayOutletName}
            onOpenMenu={() => setMenuOpen(true)}
            menuAriaLabel={t(POS_SETTINGS_I18N.menu, "Menu")}
          />
        }
      />

      <PosCashierMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        outletName={displayOutletName}
        activeId="settings"
      />

      <PosNotificationSoundSheet
        open={soundOpen}
        onOpenChange={setSoundOpen}
        value={settings.notificationSoundId}
        onSelect={(id: PosNotificationSoundId) =>
          persist({ ...settings, notificationSoundId: id })
        }
      />
    </PosSessionLeaveProvider>
  );
}
