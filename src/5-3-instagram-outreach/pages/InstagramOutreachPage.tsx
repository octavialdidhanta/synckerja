import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HeaderAndTab } from "@/5-3-dashboard/components/layout/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useActiveOrgOwnerRpc } from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import { CampaignWorkspace } from "@/5-3-whatsapp-template/layout/CampaignWorkspace";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { InstagramOutreachPageSkeleton } from "@/5-3-instagram-outreach/skeletons/InstagramOutreachPageSkeleton";
import { OutreachDetail } from "@/5-3-instagram-outreach/components/OutreachDetail";
import { normalizeInstagramUsername } from "@/5-3-instagram-outreach/lib/audience";
import {
  useConnectedInstagramAccounts,
  useInstagramOutreachCampaigns,
  useInstagramOutreachMutations,
  type OutreachCampaign,
} from "@/5-3-instagram-outreach/hooks/useInstagramOutreach";

const MAIN_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function formatWhen(value: string | null, empty: string): string {
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  return date.toLocaleString();
}

export function InstagramOutreachPage() {
  const { t } = useTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data: ownerOk, isLoading: ownerLoading } = useActiveOrgOwnerRpc(organizationId);
  const ownerReady = ownerOk === true;
  const campaignsQuery = useInstagramOutreachCampaigns(organizationId, ownerReady);
  const accountsQuery = useConnectedInstagramAccounts(organizationId, ownerReady);
  const mutations = useInstagramOutreachMutations(organizationId);
  const [view, setView] = useState<"list" | "create">("list");
  const [activeCampaign, setActiveCampaign] = useState<OutreachCampaign | null>(null);
  const [name, setName] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [accountId, setAccountId] = useState("");

  const pending = orgLoading || ownerLoading || (ownerReady && campaignsQuery.isLoading);
  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (pending) {
      setShowSkeleton(true);
      return;
    }
    const timer = window.setTimeout(() => setShowSkeleton(false), 200);
    return () => window.clearTimeout(timer);
  }, [pending]);

  const accounts = accountsQuery.data ?? [];
  useEffect(() => {
    if (accounts.length === 1 && !accountId) {
      setAccountId(accounts[0].instagram_business_account_id);
    }
  }, [accountId, accounts]);

  const campaigns = campaignsQuery.data ?? [];
  const visibleCampaign = activeCampaign
    ? campaigns.find((item) => item.id === activeCampaign.id) ?? activeCampaign
    : null;

  const onCreate = async () => {
    const username = normalizeInstagramUsername(competitor);
    if (!username) {
      toast.error(t("instagramOutreach.create.invalidUsername", "Username Instagram tidak valid."));
      return;
    }
    if (!accountId) {
      toast.error(t("instagramOutreach.create.noAccount", "Hubungkan akun Instagram dulu."));
      return;
    }
    try {
      const created = await mutations.createCampaign.mutateAsync({
        name,
        competitorUsername: username,
        instagramBusinessAccountId: accountId,
      });
      setName("");
      setCompetitor("");
      setView("list");
      setActiveCampaign({
        id: created.id,
        organization_id: organizationId ?? "",
        instagram_business_account_id: accountId,
        name: name.trim(),
        competitor_username: username,
        last_synced_at: null,
        last_sync_error: null,
        created_at: new Date().toISOString(),
        target_count: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "username") {
        toast.error(t("instagramOutreach.create.invalidUsername", "Username Instagram tidak valid."));
        return;
      }
      toast.error(t("instagramOutreach.create.failed", "Kampanye tidak tersimpan."));
    }
  };

  const ownerBlocked = !ownerLoading && ownerOk === false;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className={showSkeleton ? "invisible pointer-events-none flex min-h-0 min-w-0 flex-1 flex-col" : "flex min-h-0 min-w-0 flex-1 flex-col"}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className={MAIN_SCROLL}>
              <div className="flex min-h-full min-w-0 flex-1 flex-col bg-muted/40">
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>
                <ModuleShellContentGate pagePath="/omnichannel/campaign/instagram">
                  {ownerBlocked ? (
                    <div className="m-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <p className="font-medium">{t("instagramOutreach.ownerOnly.title", "Hanya pemilik organisasi")}</p>
                      <p className="mt-1">{t("instagramOutreach.ownerOnly.body", "Halaman ini menyimpan daftar akun per organisasi dan hanya bisa dibuka pemilik.")}</p>
                    </div>
                  ) : visibleCampaign && organizationId ? (
                    <OutreachDetail
                      organizationId={organizationId}
                      campaign={visibleCampaign}
                      onBack={() => setActiveCampaign(null)}
                    />
                  ) : view === "create" ? (
                    <CampaignWorkspace sectionLabel={t("instagramOutreach.footer.campaigns", "kampanye")}>
                      <form
                        className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void onCreate();
                        }}
                      >
                        <div>
                          <h2 className="text-base font-semibold">{t("instagramOutreach.create.title", "Kampanye baru")}</h2>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="outreach-name">{t("instagramOutreach.create.name", "Nama kampanye")}</Label>
                          <Input id="outreach-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="outreach-competitor">{t("instagramOutreach.create.competitor", "Username kompetitor")}</Label>
                          <Input
                            id="outreach-competitor"
                            value={competitor}
                            onChange={(event) => setCompetitor(event.target.value)}
                            placeholder="@resto"
                            required
                          />
                        </div>
                        {accountsQuery.isLoading ? (
                          <p className="sr-only">{t("instagramOutreach.loadingAria", "Memuat outreach Instagram")}</p>
                        ) : accounts.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t("instagramOutreach.create.noAccount", "Hubungkan akun Instagram dulu.")}{" "}
                            <Link className="underline" to="/omnichannel/integrations/instagram">
                              {t("instagramOutreach.create.connectLink", "Buka integrasi Instagram")}
                            </Link>
                          </p>
                        ) : accounts.length > 1 ? (
                          <div className="space-y-1">
                            <Label>{t("instagramOutreach.create.account", "Akun Instagram penarik")}</Label>
                            <Select value={accountId || undefined} onValueChange={setAccountId}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem
                                    key={account.instagram_business_account_id}
                                    value={account.instagram_business_account_id}
                                  >
                                    @{account.instagram_username || account.instagram_name || account.instagram_business_account_id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            @{accounts[0]?.instagram_username || accounts[0]?.instagram_name}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button type="submit" disabled={!name.trim() || accounts.length === 0 || mutations.createCampaign.isPending}>
                            {t("instagramOutreach.create.submit", "Simpan")}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setView("list")}>
                            {t("instagramOutreach.create.cancel", "Batal")}
                          </Button>
                        </div>
                      </form>
                    </CampaignWorkspace>
                  ) : (
                    <CampaignWorkspace
                      count={campaigns.length}
                      sectionLabel={t("instagramOutreach.footer.campaigns", "kampanye")}
                    >
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <div className="flex shrink-0 justify-end px-4 pt-4">
                          <Button type="button" onClick={() => setView("create")}>
                            {t("instagramOutreach.list.create", "Kampanye baru")}
                          </Button>
                        </div>
                        {campaignsQuery.isError ? (
                          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
                            <p className="text-sm text-muted-foreground">
                              {t("instagramOutreach.list.loadFailed", "Kampanye tidak dapat dimuat.")}
                            </p>
                          </div>
                        ) : campaigns.length === 0 ? (
                          <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
                            <p className="text-sm text-muted-foreground">
                              {t("instagramOutreach.list.empty", "Belum ada kampanye outreach.")}
                            </p>
                          </div>
                        ) : (
                          <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll mt-3 min-h-0 min-w-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("instagramOutreach.list.name", "Nama")}</TableHead>
                                  <TableHead>{t("instagramOutreach.list.competitor", "Kompetitor")}</TableHead>
                                  <TableHead>{t("instagramOutreach.list.lastSync", "Sinkron terakhir")}</TableHead>
                                  <TableHead>{t("instagramOutreach.list.targets", "Akun")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {campaigns.map((campaign) => (
                                  <TableRow
                                    key={campaign.id}
                                    className="cursor-pointer"
                                    onClick={() => setActiveCampaign(campaign)}
                                  >
                                    <TableCell className="font-medium">{campaign.name}</TableCell>
                                    <TableCell>@{campaign.competitor_username}</TableCell>
                                    <TableCell>
                                      {formatWhen(campaign.last_synced_at, t("instagramOutreach.list.neverSynced", "Belum"))}
                                    </TableCell>
                                    <TableCell>{campaign.target_count}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </CampaignWorkspace>
                  )}
                </ModuleShellContentGate>
                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {showSkeleton ? (
        <div className="absolute inset-0 z-10">
          <InstagramOutreachPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
