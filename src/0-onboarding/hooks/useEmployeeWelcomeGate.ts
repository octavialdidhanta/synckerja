import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";

type Phase = "checking" | "ready";

export function useEmployeeWelcomeGate(): Phase {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      const { data: uo } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!uo?.organization_id) {
        navigate("/create-organization", { replace: true });
        return;
      }
      const { data: subs } = await supabase
        .from("organization_subscriptions")
        .select("id")
        .eq("organization_id", uo.organization_id)
        .limit(1);
      if (!subs?.length) {
        navigate("/create-plan", { replace: true });
        return;
      }
      setPhase("ready");
    })();
  }, [navigate]);

  return phase;
}
