import { useQuery } from "@tanstack/react-query";
import { useCompanyProfile } from "@/2-8-dashboard/hooks/useCompanyProfile";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { defaultPosOutletId } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useOutletReceiptSettings } from "./useOutletReceiptSettings";
import { formatReceiptPhoneDisplay, storedPhoneFromNational } from "../lib/formatReceiptPhone";
import { resolveReceiptDisplay } from "../lib/resolveReceiptDisplay";
import { signOutletReceiptLogo } from "../lib/receiptLogoStorage";
import type { PosReceiptBranding, PosReceiptResolved } from "../lib/posReceipt.types";

export function useResolvedPosReceipt(outletId: string | null): PosReceiptResolved {
  const { rows: outlets, isLoading: outletsLoading } = usePosOutlets();
  const { data: company, isLoading: companyLoading } = useCompanyProfile();
  const resolvedOutletId = outletId || defaultPosOutletId(outlets);
  const outlet = outlets.find((row) => row.id === resolvedOutletId) ?? null;
  const receipt = useOutletReceiptSettings(resolvedOutletId || null);

  const logoQuery = useQuery({
    queryKey: ["pos-receipt-logo", receipt.settings?.logo_storage_path],
    queryFn: () => signOutletReceiptLogo(receipt.settings!.logo_storage_path!),
    enabled: Boolean(receipt.settings?.logo_storage_path),
    staleTime: 30 * 60 * 1000,
  });

  const hasOutletLogo = Boolean(receipt.settings?.logo_storage_path?.trim());
  const logoUrl = hasOutletLogo ? logoQuery.data ?? null : company?.logo_url ?? null;

  const display = resolveReceiptDisplay({
    outletName: outlet?.name ?? "",
    businessName: company?.company_name ?? "",
    city: outlet?.city ?? "",
    province: outlet?.province ?? "",
    postalCode: outlet?.postal_code ?? "",
    phone: formatReceiptPhoneDisplay(storedPhoneFromNational(outlet?.phone ?? "")),
    hasOutletLogo,
    footerNotes: receipt.settings?.footer_notes ?? "",
  });

  const branding: PosReceiptBranding = {
    display,
    logoUrl,
    hasOutletLogo,
    social: {
      websiteUrl: receipt.settings?.website_url ?? undefined,
      twitterUrl: receipt.settings?.twitter_url ?? undefined,
      facebookUrl: receipt.settings?.facebook_url ?? undefined,
      instagramUrl: receipt.settings?.instagram_url ?? undefined,
      tiktokUrl: receipt.settings?.tiktok_url ?? undefined,
      whatsappUrl: receipt.settings?.whatsapp_url ?? undefined,
    },
  };

  const isLoading = outletsLoading || companyLoading || receipt.isLoading || logoQuery.isLoading;

  return { branding, isLoading };
}
