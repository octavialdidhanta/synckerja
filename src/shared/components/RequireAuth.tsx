import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";

export function RequireAuth() {
  const location = useLocation();
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setStatus(session ? "in" : "out");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setStatus(session ? "in" : "out");
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Render the app shell and child routes while session resolves. A blocking spinner
  // here replaced the entire <Outlet /> tree (no header/sidebar). Pages use skeletons instead.
  if (status === "loading") {
    return <Outlet />;
  }

  if (status === "out") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
