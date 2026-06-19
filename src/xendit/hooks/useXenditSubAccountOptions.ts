import { useMemo } from "react";
import type { XenditSubAccountRow } from "@/xendit/types/xendit";
import { buildSubAccountLabel, isSubAccountSelectable } from "@/xendit/lib/xenditSubAccountUtils";

export type XenditSubAccountOption = {
  rowId: string;
  xenditSubAccountId: string;
  label: string;
  isPrimary: boolean;
};

export function useXenditSubAccountOptions(subAccounts: XenditSubAccountRow[] | undefined) {
  return useMemo(() => {
    const options: XenditSubAccountOption[] = [];
    for (const row of subAccounts ?? []) {
      if (!isSubAccountSelectable(row)) continue;
      const xenditId = row.xendit_sub_account_id?.trim();
      if (!xenditId) continue;
      options.push({
        rowId: row.id,
        xenditSubAccountId: xenditId,
        label: buildSubAccountLabel(row),
        isPrimary: row.is_primary,
      });
    }
    return options;
  }, [subAccounts]);
}
