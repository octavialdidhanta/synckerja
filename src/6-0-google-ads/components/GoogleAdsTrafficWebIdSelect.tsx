import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgTrafficWebPreference } from "@/google-ads/hooks/useOrgTrafficWebPreference";

type Props = {
  organizationId: string | null | undefined;
  disabled?: boolean;
  onChanged?: () => void;
};

export function GoogleAdsTrafficWebIdSelect({
  organizationId,
  disabled,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const { defaultWebId, isLoading: prefLoading, save } = useOrgTrafficWebPreference(organizationId);

  const webIdsQuery = useQuery({
    queryKey: ["traffic", "accessible-web-ids", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_accessible_web_ids");
      if (error) throw error;
      return ((data ?? []) as Array<{ web_id: string }>).map((r) => r.web_id);
    },
    staleTime: 60_000,
  });

  const webIds = webIdsQuery.data ?? [];
  const loading = prefLoading || webIdsQuery.isLoading;

  useEffect(() => {
    if (!organizationId || loading || webIds.length === 0 || save.isPending) return;
    if (!defaultWebId && webIds[0]) {
      void save.mutateAsync(webIds[0]);
    }
  }, [organizationId, loading, webIds, defaultWebId, save]);
  const value = defaultWebId && webIds.includes(defaultWebId)
    ? defaultWebId
    : webIds[0] ?? "";

  if (!loading && webIds.length === 0) return null;

  return (
    <Select
      value={value || undefined}
      disabled={disabled || loading || webIds.length === 0 || save.isPending}
      onValueChange={(next) => {
        void save.mutateAsync(next).then(() => onChanged?.());
      }}
    >
      <SelectTrigger
        className="h-9 w-[min(11rem,30vw)] border-gray-200 bg-gray-50 text-xs"
        aria-label={t("digitalMarketing.googleAds.trafficWebIdLabel", "Traffic source")}
      >
        <SelectValue
          placeholder={t("digitalMarketing.googleAds.trafficWebIdPlaceholder", "Traffic web_id")}
        />
      </SelectTrigger>
      <SelectContent className="z-50 max-h-72 bg-white">
        {webIds.map((id) => (
          <SelectItem key={id} value={id} className="text-xs">
            {id}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
