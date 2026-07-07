import { useEffect } from "react";
import { DOCUMENT_TITLE_DEFAULT } from "@/policy/policyBranding";

export function useDocumentTitle(title: string, restoreTitle = DOCUMENT_TITLE_DEFAULT) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = restoreTitle;
    };
  }, [title, restoreTitle]);
}
