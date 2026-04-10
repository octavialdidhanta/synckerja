import { NavigationFooter } from "@/mobile/components/NavigationFooter";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { Card } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { User, MapPin, Phone, Mail, Calendar, LogOut, ChevronDown, Building2, Check, Loader2, KeyRound, RefreshCw } from "lucide-react";
import { ProfileSkeleton } from "./ProfileSkeleton";
import { useProfile } from "@/mobile/hooks/useProfile";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/features/ui/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePhotoUpload } from "@/mobile/components/ProfilePhotoUpload";
import { useOrganizationList } from "@/mobile/hooks/useOrganizationList";
import { OrganizationSelectDrawer } from "@/mobile/components/OrganizationSelectDrawer";
import { useOrganizationSwitchCallback } from "@/mobile/hooks/useOrganizationSwitchCallback";
import { useLanguage } from "@/features/share/i18n/LanguageProvider";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useCentralizedUserData } from "@/features/1-login/contexts/CentralizedUserDataContext";
import type { AppLanguage } from "@/features/share/i18n/translations";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile/components/ui/drawer";
import { ChangePasswordModal } from "@/mobile/components/ChangePasswordModal";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const Profile = () => {
  const {
    profile,
    loading,
    error,
    logout,
    refetch
  } = useProfile();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);
  const [languageDrawerOpen, setLanguageDrawerOpen] = useState(false);
  const {
    organizations,
    activeOrganization,
    loading: organizationsLoading,
    switchingOrganization,
  } = useOrganizationList();
  const onOrganizationSwitched = useOrganizationSwitchCallback();
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
  const { language, setLanguage } = useLanguage();
  const { t } = useAppTranslation();
  const { userRole } = useCentralizedUserData();

  const getRoleDisplayText = (role: string | null) => {
    if (!role) return "—";
    switch (role) {
      case "owner": return t("profile.role.owner", "Owner");
      case "admin": return t("profile.role.admin", "Admin");
      case "employee": return t("profile.role.employee", "Employee");
      case "hr": return t("profile.role.hr", "HR");
      default: return role;
    }
  };
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: t("profile.logoutSuccess", "Berhasil logout"),
        description: t("profile.logoutSuccessDesc", "Anda telah berhasil keluar dari sistem")
      });
      navigate("/login");
    } catch (err) {
      toast({
        title: t("profile.error", "Error"),
        description: t("profile.logoutFailed", "Gagal logout. Silakan coba lagi."),
        variant: "destructive"
      });
    }
  };

  const canOpenOrgDrawer = organizations.length > 1 && !switchingOrganization;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const didRecoveryRefetch = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    if (didRecoveryRefetch.current || loading || profile) return;
    didRecoveryRefetch.current = true;
    refetch().catch(() => {});
  }, [loading, profile, refetch]);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } catch {
      toast({
        title: t("profile.error", "Error"),
        description: t("profile.refreshFailed", "Gagal memperbarui"),
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, toast, t]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el?.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const y = e.touches[0].clientY;
      const delta = y - touchStartY.current;
      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing]
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      handlePullRefresh();
    }
  }, [handlePullRefresh]);

  if (loading && !isRefreshing) {
    return (
      <DesktopWarning>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
              <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden" />
                  <div>
                    <h1 className="text-base font-semibold text-foreground">{t("profile.pageTitle", "Profile")}</h1>
                    <p className="text-xs text-muted-foreground">{t("profile.pageSubtitle", "Profil dan pengaturan")}</p>
                  </div>
                </div>
                <div></div>
              </header>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col">
                  <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default">
                    <ProfileSkeleton />
                  </div>
                </div>
              </div>
              <NavigationFooter className="safe-area-bottom-lower" />
            </main>
          </div>
        </SidebarProvider>
      </DesktopWarning>
    );
  }
  if (error || !profile) {
    return (
      <DesktopWarning>
        <SidebarProvider>
          <div className="min-h-screen flex w-full bg-background">
            <AppSidebar />
            <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
              <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden" />
                  <div>
                    <h1 className="text-base font-semibold text-foreground">{t("profile.pageTitle", "Profile")}</h1>
                    <p className="text-xs text-muted-foreground">{t("profile.pageSubtitle", "Profil dan pengaturan")}</p>
                  </div>
                </div>
                <div></div>
              </header>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col items-center justify-center">
                  <div className="text-center p-4">
                    <p className="text-destructive mb-4">{t("profile.loadFailed", "Gagal memuat profil")}</p>
                    <Button onClick={() => refetch()}>{t("profile.tryAgain", "Coba Lagi")}</Button>
                  </div>
                </div>
              </div>
              <NavigationFooter className="safe-area-bottom-lower" />
            </main>
          </div>
        </SidebarProvider>
      </DesktopWarning>
    );
  }
  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          {/* Layout per .cursor/rules/mobile-tools-layout-android.mdc */}
          <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
            <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <div>
                  <h1 className="text-base font-semibold text-foreground">{t("profile.pageTitle", "Profile")}</h1>
                  <p className="text-xs text-muted-foreground">{t("profile.pageSubtitle", "Profil dan pengaturan")}</p>
                </div>
              </div>
              <div></div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <div
                ref={listScrollRef}
                className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div
                  className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
                  style={{
                    height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                    minHeight: 0,
                    transition: isPulling ? 'none' : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
                  ) : pullDistance >= PULL_THRESHOLD ? (
                    <span className="text-xs font-medium text-primary whitespace-nowrap">
                      {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
                    </span>
                  ) : (
                    <RefreshCw
                      className="h-5 w-5 opacity-80 shrink-0"
                      style={{
                        transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                        transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                      }}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-default space-y-1">
                  <div>
                    <Card className="bg-gradient-card border border-border">
                      <div className="p-4 text-center">
                        <ProfilePhotoUpload profile={profile} />
                        <h2 className="text-xl font-semibold text-foreground mb-1 mt-3">{profile.full_name}</h2>
                        <p className="text-sm text-muted-foreground">{profile.job_position_name || t("profile.employee", "Karyawan")}</p>
                      </div>
                    </Card>
                  </div>

                  <div>
                    <Card className="bg-gradient-card border border-border">
                <div className="p-3 border-b border-border">
                  <h3 className="font-semibold text-foreground">{t("profile.personalInfo", "Informasi Personal")}</h3>
                </div>
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">{t("profile.email", "Email")}</p>
                      <p className="text-sm font-medium text-foreground">{profile.email}</p>
                    </div>
                  </div>
                  {profile.mobile_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("profile.phone", "Telepon")}</p>
                        <p className="text-sm font-medium text-foreground">{profile.mobile_phone}</p>
                      </div>
                    </div>
                  )}
                  {profile.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("profile.address", "Alamat")}</p>
                        <p className="text-sm font-medium text-foreground">{profile.address}</p>
                      </div>
                    </div>
                  )}
                  {profile.join_date && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("profile.joined", "Bergabung")}</p>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(profile.join_date).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                    </Card>
                  </div>

                  <div>
                    <Card className="bg-gradient-card border border-border">
                      <div className="p-3 border-b border-border">
                        <h3 className="font-semibold text-foreground">{t("profile.workInfo", "Informasi Kerja")}</h3>
                      </div>
                <div className="p-3 space-y-3">
                  {profile.job_position_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("profile.position", "Posisi")}</span>
                      <span className="text-sm font-medium text-foreground">{profile.job_position_name}</span>
                    </div>
                  )}
                  {profile.department_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("profile.department", "Departemen")}</span>
                      <span className="text-sm font-medium text-foreground">{profile.department_name}</span>
                    </div>
                  )}
                  {profile.job_level_name && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("profile.level", "Level")}</span>
                      <span className="text-sm font-medium text-foreground">{profile.job_level_name}</span>
                    </div>
                  )}
                  {profile.employee_id && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("profile.employeeId", "ID Karyawan")}</span>
                      <span className="text-sm font-medium text-foreground">{profile.employee_id}</span>
                    </div>
                  )}
                  {profile.status && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{t("profile.statusLabel", "Status")}</span>
                      <span className="text-sm font-medium text-foreground capitalize">{profile.status}</span>
                    </div>
                  )}
                </div>
                    </Card>
                  </div>

                  <div>
                    <Card className="bg-gradient-card border border-border">
                      <div className="px-3 py-2 border-b border-border">
                        <h3 className="text-sm font-medium text-foreground">{t("profile.yourOrganizations", "Organisasi Anda ({{count}})", { count: organizations.length })}</h3>
                      </div>
                      <div className="p-2 space-y-2">
                  {/* Organization trigger: opens drawer when multiple orgs */}
                  <div
                    role={canOpenOrgDrawer ? "button" : undefined}
                    tabIndex={canOpenOrgDrawer ? 0 : undefined}
                    onClick={canOpenOrgDrawer && !switchingOrganization ? () => setOrgDrawerOpen(true) : undefined}
                    onKeyDown={
                      canOpenOrgDrawer
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOrgDrawerOpen(true);
                            }
                          }
                        : undefined
                    }
                    className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border transition-colors min-h-[44px]"
                    style={organizations.length > 1 && !switchingOrganization ? { cursor: "pointer" } : undefined}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {organizationsLoading ? t("profile.loading", "Memuat...") : switchingOrganization ? t("profile.switchingOrg", "Beralih organisasi...") : activeOrganization?.company_name || t("profile.selectOrganization", "Pilih Organisasi")}
                        </p>
                        <p className="text-xs text-muted-foreground">{getRoleDisplayText(userRole)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {switchingOrganization ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : (
                        <>
                          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                          {canOpenOrgDrawer && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </>
                      )}
                    </div>
                  </div>

                  <OrganizationSelectDrawer
                    open={orgDrawerOpen}
                    onOpenChange={setOrgDrawerOpen}
                    onSwitched={() => {
                      refetch();
                      onOrganizationSwitched();
                    }}
                  />

                  {/* Create New Organization Button */}
                  <Button variant="outline" size="sm" className="w-full h-9 border-border hover:bg-muted justify-start text-sm" onClick={() => navigate('/create-organization')}>
                    <svg className="h-3.5 w-3.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t("profile.createNewOrg", "Buat Organisasi Baru")}
                  </Button>
                      </div>
                    </Card>
                  </div>

                  <div>
                    <Card className="bg-gradient-card border border-border">
                      <div className="p-3 border-b border-border">
                        <h3 className="font-semibold text-foreground">{t("settings.section.title", "Pengaturan")}</h3>
                      </div>
                      <div className="p-3 space-y-3">
                        <Drawer open={languageDrawerOpen} onOpenChange={setLanguageDrawerOpen}>
                          <DrawerTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-10 justify-between gap-2 text-left px-3"
                            >
                              <span>
                                {language === "id"
                                  ? t("settings.profile.language.option.id", "Bahasa Indonesia")
                                  : t("settings.profile.language.option.en", "English")}
                              </span>
                              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            </Button>
                          </DrawerTrigger>
                          <DrawerContent className="max-h-[85dvh] flex flex-col">
                            <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                              <DrawerTitle className="text-lg font-semibold">
                                {t("settings.profile.language.title", "Application Language")}
                              </DrawerTitle>
                            </DrawerHeader>
                            <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                              <div className="flex flex-col gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLanguage("id" as AppLanguage, { deviceOnly: true });
                                    setLanguageDrawerOpen(false);
                                  }}
                                  className={cn(
                                    "w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors",
                                    language === "id"
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background border-input hover:bg-muted"
                                  )}
                                >
                                  {t("settings.profile.language.option.id", "Bahasa Indonesia")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLanguage("en" as AppLanguage, { deviceOnly: true });
                                    setLanguageDrawerOpen(false);
                                  }}
                                  className={cn(
                                    "w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors",
                                    language === "en"
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background border-input hover:bg-muted"
                                  )}
                                >
                                  {t("settings.profile.language.option.en", "English")}
                                </button>
                              </div>
                            </div>
                            <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                              <DrawerClose asChild>
                                <Button className="w-full" size="sm">
                                  {t("dailyTaskReport.filters.done", "Done")}
                                </Button>
                              </DrawerClose>
                            </div>
                          </DrawerContent>
                        </Drawer>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-3 h-11"
                          onClick={() => setChangePasswordOpen(true)}
                        >
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          {t("profile.changePassword", "Ubah Password")}
                        </Button>
                      </div>
                    </Card>
                  </div>

                  <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

                  <div>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full h-12 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground justify-start" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-3" />
                        {t("profile.logoutButton", "Keluar")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          </div>

          <NavigationFooter className="safe-area-bottom-lower" />
        </main>
        </div>
      </SidebarProvider>
    </DesktopWarning>
  );
};
export default Profile;