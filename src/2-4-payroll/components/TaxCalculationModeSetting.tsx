import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { toast } from "sonner";
import {
  defaultTaxConfigurationQueryKey,
  useDefaultTaxConfiguration,
} from "../hooks/useDefaultTaxConfiguration";

export function TaxCalculationModeSetting() {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const queryClient = useQueryClient();
  const { data: taxConfig } = useDefaultTaxConfiguration(organizationId);
  const [loading, setLoading] = useState(false);

  const mode = taxConfig?.calculation_mode ?? "annualized";

  const handleChange = async (value: "annualized" | "ter") => {
    if (!taxConfig?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tax_configurations")
        .update({ calculation_mode: value })
        .eq("id", taxConfig.id);
      if (error) throw error;

      queryClient.setQueryData(defaultTaxConfigurationQueryKey(organizationId), {
        ...taxConfig,
        calculation_mode: value,
      });

      toast.success(value === "ter" ? "Mode pajak: TER (PP 58/2023)" : "Mode pajak: Annualized");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update mode pajak");
    } finally {
      setLoading(false);
    }
  };

  if (!organizationId || !taxConfig?.id) return null;

  return (
    <div className="border-border space-y-1 border-t px-4 py-3">
      <Label className="text-muted-foreground text-xs">Metode PPh21 Organisasi</Label>
      <Select value={mode} onValueChange={(v) => void handleChange(v as "annualized" | "ter")} disabled={loading}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="annualized">Annualized (progresif tahunan)</SelectItem>
          <SelectItem value="ter">TER (PP 58/2023)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
