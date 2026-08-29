import { useEffect } from "react";
import { markPosAuthSurface } from "./posAuthSurface";

/** Ensures RequireAuth / session-expired redirects stay on POS login. */
export function useMarkPosAuthSurface() {
  useEffect(() => {
    markPosAuthSurface();
  }, []);
}
