import { useLayoutEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";

/**
 * Guards /create-organization: redirects when unauthenticated, unverified, or already onboarded.
 * Returns true while the initial check is running.
 */
export function useCreateOrganizationGate(): boolean {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const email = (user.email ?? "").trim();
      const { data: hasVerifiedToken, error: verifyRpcError } = await supabase.rpc(
        "registration_has_verified_email",
        { p_user_id: user.id, p_email: email },
      );

      if (cancelled) return;

      if (verifyRpcError || !hasVerifiedToken) {
        navigate("/register", { replace: true });
        return;
      }

      const { data: uoList, error: uoErr } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (cancelled) return;

      if (uoErr) {
        console.warn("user_organizations guard:", uoErr);
      }

      if (uoList?.length) {
        const orgId = uoList[0].organization_id;
        const { data: subs } = await supabase
          .from("organization_subscriptions")
          .select("id")
          .eq("organization_id", orgId)
          .limit(1);
        if (cancelled) return;
        if (subs?.length) {
          navigate(localStorage.getItem("hasSeenEmployeeWelcome") ? "/" : "/employee-welcome", {
            replace: true,
          });
        } else {
          navigate("/create-plan", { replace: true });
        }
        return;
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, location.key]);

  return loading;
}
