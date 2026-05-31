import { useEffect, useState } from "react";
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

export function TaxCalculationModeSetting() {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const [mode, setMode] = useState<"annualized" | "ter">("annualized");
  const [taxConfigId, setTaxConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    void (async () => {
      const { data } = await supabase
        .from("tax_configurations")
        .select("id, calculation_mode")
        .eq("organization_id", organizationId)
        .eq("is_default", true)
        .maybeSingle();
      if (data?.id) {
        setTaxConfigId(data.id);
        setMode((data.calculation_mode as "annualized" | "ter") ?? "annualized");
      }
    })();
  }, [organizationId]);

  const handleChange = async (value: "annualized" | "ter") => {
    if (!taxConfigId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tax_configurations")
        .update({ calculation_mode: value })
        .eq("id", taxConfigId);
      if (error) throw error;
      setMode(value);
      toast.success(value === "ter" ? "Mode pajak: TER (PP 58/2023)" : "Mode pajak: Annualized");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update mode pajak");
    } finally {
      setLoading(false);
    }
  };

  if (!organizationId || !taxConfigId) return null;

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
