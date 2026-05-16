import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/** Same tab routes as `OKRPage` — usable from skeleton shells before page data is ready. */
export function useOkrHeaderTabChange() {
  const navigate = useNavigate();
  return useCallback(
    (tab: string) => {
      if (tab === "department-objectives") {
        navigate("/okr/department-objective");
      } else if (tab === "individual-objectives") {
        navigate("/okr/individual-objective");
      } else {
        navigate("/okr/company-objective");
      }
    },
    [navigate],
  );
}
