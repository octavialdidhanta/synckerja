import { useEffect, useMemo } from "react";
import { useWhatsAppAccounts } from "@/5-3-whatsapp/hooks/useWhatsAppAccounts";
import { useWhatsAppMessageTemplates } from "@/5-3-whatsapp-template/hooks/useWhatsAppMessageTemplates";
import { mapMetaTemplateToRow } from "@/5-3-whatsapp-template/utils/mapMetaTemplateToRow";
import type { MetaMessageTemplate, TemplateTableRow } from "@/5-3-whatsapp-template/types";

/** Mirror resolveOrganizationWhatsAppCredentials: newest active account. */
function pickDefaultWhatsAppAccountId(
  accounts: Array<{ id: string; is_active: boolean }>,
): string | null {
  const active = accounts.filter((a) => a.is_active);
  return active[0]?.id ?? null;
}

export function countTemplateBodySlots(row: TemplateTableRow): number {
  return (row.bodyFull.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

export function templateSelectionKey(name: string, language: string): string {
  return `${name.trim()}::${language.trim()}`;
}

export function useApprovedWhatsAppTemplatesFlat(options?: { enabled?: boolean }) {
  const queryEnabled = options?.enabled ?? true;
  const { accounts, isLoading: accountsLoading } = useWhatsAppAccounts();

  const waAccountId = useMemo(() => pickDefaultWhatsAppAccountId(accounts), [accounts]);

  const tplQuery = useWhatsAppMessageTemplates(waAccountId, {
    enabled: queryEnabled && Boolean(waAccountId),
  });

  useEffect(() => {
    if (!queryEnabled || !waAccountId) return;
    if (tplQuery.hasNextPage && !tplQuery.isFetchingNextPage) {
      void tplQuery.fetchNextPage();
    }
  }, [
    queryEnabled,
    waAccountId,
    tplQuery.hasNextPage,
    tplQuery.isFetchingNextPage,
    tplQuery.fetchNextPage,
    tplQuery.dataUpdatedAt,
  ]);

  const rows: TemplateTableRow[] = useMemo(() => {
    const pages = tplQuery.data?.pages ?? [];
    const metas = pages.flatMap((p) => p.data ?? []) as MetaMessageTemplate[];
    return metas
      .map((m) => mapMetaTemplateToRow(m))
      .filter((x): x is TemplateTableRow => Boolean(x))
      .filter((row) => row.statusRaw === "APPROVED");
  }, [tplQuery.data?.pages]);

  const isLoading =
    accountsLoading ||
    (Boolean(waAccountId) &&
      (tplQuery.isLoading || tplQuery.isFetchingNextPage || tplQuery.hasNextPage));

  const waConfigured = accounts.some((a) => a.is_active);

  return {
    rows,
    isLoading,
    isError: tplQuery.isError,
    waConfigured,
    waAccountId,
  };
}
