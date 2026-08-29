import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { AssignFeatureAccessDialog } from "./AssignFeatureAccessDialog";
import { FeatureAccessTable } from "./FeatureAccessTable";
import { StockCommitPointSection } from "./StockCommitPointSection";
import { WorkflowModeSection } from "./WorkflowModeSection";
import { useCatalogInventorySettings } from "../hooks/useCatalogInventorySettings";
import {
  PO_FEATURE_KEYS,
  TRANSFER_FEATURE_KEYS,
  featureAccessLabelKey,
  mergeFeatureAccess,
} from "../lib/inventoryFeatureKeys";
import type { InventoryFeatureKey, InventoryUserRole, InventoryWorkflowMode } from "../types";
import { INVENTORY_RPC_ERRORS } from "../types";

function mapRpcError(error: unknown, t: ReturnType<typeof useAppTranslation>["t"]): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("catalog_inventory_access_roles_required")) {
    return t(INVENTORY_RPC_ERRORS.catalog_inventory_access_roles_required, "Assign at least one role for each feature.");
  }
  if (message.includes("forbidden")) {
    return t(INVENTORY_RPC_ERRORS.forbidden, "You do not have permission to manage inventory settings.");
  }
  return message || t("common.errorGeneric", "Something went wrong.");
}

export function InventorySettingsPageContent() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { isOwner, isAdmin } = useCentralizedUserData();
  const canManage = isOwner || isAdmin;
  const { settings, isLoading, save, isSaving } = useCatalogInventorySettings();

  const [poMode, setPoMode] = useState<InventoryWorkflowMode>("simple");
  const [transferMode, setTransferMode] = useState<InventoryWorkflowMode>("simple");
  const [featureAccess, setFeatureAccess] = useState<
    Array<{ feature_key: InventoryFeatureKey; allowed_roles: InventoryUserRole[] }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<InventoryFeatureKey[]>([]);
  const [modalFeature, setModalFeature] = useState<InventoryFeatureKey | null>(null);

  useEffect(() => {
    if (!settings) return;
    setPoMode(settings.po_mode);
    setTransferMode(settings.transfer_mode);
    setFeatureAccess(
      mergeFeatureAccess(settings.feature_access, settings.po_mode, settings.transfer_mode),
    );
  }, [settings]);

  useEffect(() => {
    setFeatureAccess((prev) => mergeFeatureAccess(prev, poMode, transferMode));
  }, [poMode, transferMode]);

  const poRows = useMemo(
    () => featureAccess.filter((row) => PO_FEATURE_KEYS.includes(row.feature_key)),
    [featureAccess],
  );
  const transferRows = useMemo(
    () => featureAccess.filter((row) => TRANSFER_FEATURE_KEYS.includes(row.feature_key)),
    [featureAccess],
  );

  const isDirty = useMemo(() => {
    if (!settings) return false;
    const baseline = mergeFeatureAccess(settings.feature_access, settings.po_mode, settings.transfer_mode);
    if (poMode !== settings.po_mode || transferMode !== settings.transfer_mode) return true;
    return JSON.stringify(baseline) !== JSON.stringify(featureAccess);
  }, [featureAccess, poMode, settings, transferMode]);

  const busy = saving || isSaving || isLoading;

  const handleSave = async () => {
    const requiredKeys: InventoryFeatureKey[] = [
      ...(poMode === "advanced" ? PO_FEATURE_KEYS : []),
      ...(transferMode === "advanced" ? TRANSFER_FEATURE_KEYS : []),
    ];
    const missing = requiredKeys.filter(
      (key) => !(featureAccess.find((row) => row.feature_key === key)?.allowed_roles.length ?? 0),
    );
    if (missing.length > 0) {
      setInvalidKeys(missing);
      toast({
        title: t(
          INVENTORY_RPC_ERRORS.catalog_inventory_access_roles_required,
          "Assign at least one role for each feature.",
        ),
        variant: "destructive",
      });
      return;
    }

    setInvalidKeys([]);
    setSaving(true);
    try {
      await save({
        po_mode: poMode,
        transfer_mode: transferMode,
        feature_access: featureAccess.filter((row) => requiredKeys.includes(row.feature_key)),
      });
      toast({
        title: t("settings.inventory.saved", "Setting has been successfully updated"),
      });
    } catch (error) {
      toast({
        title: mapRpcError(error, t),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignRoles = (roles: InventoryUserRole[]) => {
    if (!modalFeature) return;
    setFeatureAccess((prev) =>
      prev.map((row) =>
        row.feature_key === modalFeature ? { ...row, allowed_roles: roles } : row,
      ),
    );
    setInvalidKeys((prev) => prev.filter((key) => key !== modalFeature));
    setModalFeature(null);
  };

  if (!canManage) {
    return (
      <div className="rounded-md border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        {t(
          "settings.inventory.noAccess",
          "Only Business Owner and Administrator can manage inventory settings.",
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("settings.inventory.heading", "Inventory")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "settings.inventory.intro",
              "Configure purchase order and stock transfer workflows for your organization.",
            )}
          </p>
        </div>

        <WorkflowModeSection
          title={t("settings.inventory.po.title", "Purchase Order Configuration")}
          description={t(
            "settings.inventory.po.description",
            "Choose how purchase orders are created and fulfilled across your outlets.",
          )}
          mode={poMode}
          onModeChange={setPoMode}
          namePrefix="po"
          simpleTitle={t("settings.inventory.mode.simple", "Simple")}
          simpleDescription={t(
            "settings.inventory.po.simpleDescription",
            "Create a purchase order and receive stock immediately.",
          )}
          advancedTitle={t("settings.inventory.mode.advanced", "Advanced")}
          advancedDescription={t(
            "settings.inventory.po.advancedDescription",
            "Request → Approval → Payment (Expenses) → Fulfillment.",
          )}
          disabled={busy}
        >
          <FeatureAccessTable
            rows={poRows}
            invalidKeys={invalidKeys}
            disabled={busy}
            onManageRoles={setModalFeature}
          />
          <p className="text-xs text-muted-foreground">
            {t(
              "settings.inventory.po.paymentFootnote",
              "Payment still goes through Expenses before fulfillment in Advanced mode.",
            )}
          </p>
        </WorkflowModeSection>

        <WorkflowModeSection
          title={t("settings.inventory.transfer.title", "Transfer Configuration")}
          description={t(
            "settings.inventory.transfer.description",
            "Choose how stock transfers move inventory between outlets.",
          )}
          mode={transferMode}
          onModeChange={setTransferMode}
          namePrefix="transfer"
          simpleTitle={t("settings.inventory.mode.simple", "Simple")}
          simpleDescription={t(
            "settings.inventory.transfer.simpleDescription",
            "Transfer stock instantly between outlets.",
          )}
          advancedTitle={t("settings.inventory.mode.advanced", "Advanced")}
          advancedDescription={t(
            "settings.inventory.transfer.advancedDescription",
            "Request → Approval → Shipment → Fulfillment.",
          )}
          disabled={busy}
        >
          <FeatureAccessTable
            rows={transferRows}
            invalidKeys={invalidKeys}
            disabled={busy}
            onManageRoles={setModalFeature}
          />
        </WorkflowModeSection>

        <div className="flex justify-end border-t border-border pt-4">
          <Button type="button" onClick={() => void handleSave()} disabled={busy || !isDirty}>
            {t("common.save", "Save")}
          </Button>
        </div>

        <StockCommitPointSection />
      </div>

      <AssignFeatureAccessDialog
        open={modalFeature !== null}
        onOpenChange={(open) => {
          if (!open) setModalFeature(null);
        }}
        featureKey={modalFeature}
        featureLabel={
          modalFeature ? t(featureAccessLabelKey(modalFeature), modalFeature) : ""
        }
        selectedRoles={
          modalFeature
            ? featureAccess.find((row) => row.feature_key === modalFeature)?.allowed_roles ?? []
            : []
        }
        onAssign={handleAssignRoles}
        busy={busy}
      />
    </div>
  );
}
