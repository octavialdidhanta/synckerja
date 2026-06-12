import { NavigationFooter } from "@/mobile-app/components/NavigationFooter";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { Card } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { User, LogOut, ChevronDown, ChevronRight, Building2, Check, Loader2, KeyRound, RefreshCw, Phone, Users, GraduationCap, DollarSign, FolderOpen, Briefcase, AlertTriangle } from "lucide-react";
import { ProfileSkeleton } from "./ProfileSkeleton";
import { useProfile } from "@/mobile-app/hooks/useProfile";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/shared/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { ProfilePhotoUpload } from "@/mobile/1-profile/components/ProfilePhotoUpload";
import { useOrganizationList } from "@/mobile-app/hooks/useOrganizationList";
import { OrganizationSelectDrawer } from "@/mobile-app/components/OrganizationSelectDrawer";
import { useOrganizationSwitchCallback } from "@/shared/hooks/useOrganizationSwitchCallback";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SubscriptionExpiryBannerSlot } from "@/10-subscription/shared/SubscriptionExpiryBannerSlot";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useUserOrganizations } from "@/shared/hooks/useUserOrganizations";
import type { AppLanguage } from "@/shared/i18n/translations";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile-app/components/ui/drawer";
import { ChangePasswordModal } from "@/mobile/1-profile/components/ChangePasswordModal";
import { MyInfoDetailModal } from "@/mobile/1-profile/components/MyInfoDetailModal";
import { EmergencyContactDetailModal } from "@/mobile/1-profile/components/EmergencyContactDetailModal";
import { FamilyInfoDetailModal } from "@/mobile/1-profile/components/FamilyInfoDetailModal";
import { EducationExperienceDetailModal } from "@/mobile/1-profile/components/EducationExperienceDetailModal";
import { PayrollInfoDetailModal } from "@/mobile/1-profile/components/PayrollInfoDetailModal";
import { MyFilesDetailModal } from "@/mobile/1-profile/components/MyFilesDetailModal";
import { MyWorkDetailModal } from "@/mobile/1-profile/components/MyWorkDetailModal";
import { ReprimandDetailModal } from "@/mobile/1-profile/components/ReprimandDetailModal";
import { CreateOrganizationModal } from "@/shared/layouts/header/CreateOrganizationModal";
import { cn } from "@/shared/lib/utils";

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
  const [myInfoOpen, setMyInfoOpen] = useState(false);
  const [emergencyContactOpen, setEmergencyContactOpen] = useState(false);
  const [familyInfoOpen, setFamilyInfoOpen] = useState(false);
  const [educationExperienceOpen, setEducationExperienceOpen] = useState(false);
  const [payrollInfoOpen, setPayrollInfoOpen] = useState(false);
  const [myFilesOpen, setMyFilesOpen] = useState(false);
  const [myWorkOpen, setMyWorkOpen] = useState(false);
  const [reprimandOpen, setReprimandOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [orgDrawerOpen, setOrgDrawerOpen] = useState(false);
  const [languageDrawerOpen, setLanguageDrawerOpen] = useState(false);
  const {
    organizations,
    activeOrganizationId,
    activeOrganization,
    loading: organizationsLoading,
    switchingOrganization,
  } = useOrganizationList();
  const onOrganizationSwitched = useOrganizationSwitchCallback();
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
  const { language, setLanguage } = useLanguage();
  const { t } = useAppTranslation();
  const { userRole, user } = useCentralizedUserData();
  const { data: userOrgsData } = useUserOrganizations();
  const roleFromMembership =
    activeOrganizationId && userOrgsData?.memberships.length
      ? userOrgsData.memberships.find((m) => m.organizationId === activeOrganizationId)?.role
      : undefined;
  const organizationRoleForUi = userRole ?? roleFromMembership ?? null;

  const getRoleDisplayText = (role: string | null) => {
    if (!role) return "—";
    switch (role) {
      case "owner": return t("profile.role.owner", "Owner");
      case "admin": return t("profile.role.admin", "Admin");
      case "employee": return t("profile.role.employee", "Employee");
      case "hr": return t("profile.role.hr", "HR");
      case "manager": return t("profile.role.manager", "Manager");
      case "member": return t("profile.role.member", "Member");
      default: return role;
    }
  };

  /** Selaraskan dengan kartu organisasi: posisi kerja jika ada, lalu role org (bukan fallback "Employee" saat user Owner/admin). */
  const profileHeroSubtitle =
    profile?.job_position_name?.trim() ||
    (organizationRoleForUi
      ? getRoleDisplayText(organizationRoleForUi)
      : "") ||
    t("profile.employee", "Karyawan");
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
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="mx-auto flex w-full min-h-0 max-w-md flex-1 flex-col items-center justify-center px-2 pt-2 content-padding-above-nav-default">
                    <div className="p-4 text-center">
                      <p className="mb-4 text-destructive">{t("profile.loadFailed", "Gagal memuat profil")}</p>
                      <Button onClick={() => refetch()}>{t("profile.tryAgain", "Coba Lagi")}</Button>
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
  }
  return (
    <DesktopWarning>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          {/* Layout per android-mobile/rules/mobile-tools-layout-android.mdc */}
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

            <SubscriptionExpiryBannerSlot />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                ref={listScrollRef}
                className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                        <p className="text-sm text-muted-foreground">{profileHeroSubtitle}</p>
                      </div>
                    </Card>
                  </div>

                  <div>
                    <Card className="bg-gradient-card border border-border">
                <div className="p-3 border-b border-border">
                  <h3 className="font-semibold text-foreground">{t("profile.personalInfo", "Informasi Personal")}</h3>
                </div>
                <div className="p-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-between h-11 px-0 hover:bg-transparent"
                    onClick={() => setMyInfoOpen(true)}
                  >
                    <span className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {t("profile.myInfo.button", "My Info")}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Button>
                  <div className="border-t border-border">
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-11 px-0 hover:bg-transparent"
                      onClick={() => setEmergencyContactOpen(true)}
                    >
                      <span className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {t("profile.emergencyContact.button", "Info Kontak Darurat")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  </div>
                  <div className="border-t border-border">
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-11 px-0 hover:bg-transparent"
                      onClick={() => setFamilyInfoOpen(true)}
                    >
                      <span className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {t("profile.familyInfo.button", "Info Keluarga")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  </div>
                  <div className="border-t border-border">
                    <Button
                      variant="ghost"
                      className="w-full justify-between h-11 px-0 hover:bg-transparent"
                      onClick={() => setEducationExperienceOpen(true)}
                    >
                      <span className="flex items-center gap-3">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {t("profile.educationExperience.button", "Pendidikan & Pengalaman")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  </div>
                </div>
                    </Card>
                  </div>

                  <div>
                    <Card className="bg-gradient-card border border-border">
                      <div className="p-3 border-b border-border">
                        <h3 className="font-semibold text-foreground">{t("profile.workInfo", "Informasi Kerja")}</h3>
                      </div>
                <div className="p-3">
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-between px-0 hover:bg-transparent"
                    onClick={() => setPayrollInfoOpen(true)}
                  >
                    <span className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {t("profile.payrollInfo.button", "Info Payroll")}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                  <div className="border-t border-border">
                    <Button
                      variant="ghost"
                      className="h-11 w-full justify-between px-0 hover:bg-transparent"
                      onClick={() => setMyFilesOpen(true)}
                    >
                      <span className="flex items-center gap-3">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {t("profile.myFiles.button", "File Saya")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="border-t border-border">
                    <Button
                      variant="ghost"
                      className="h-11 w-full justify-between px-0 hover:bg-transparent"
                      onClick={() => setMyWorkOpen(true)}
                    >
                      <span className="flex items-center gap-3">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {t("profile.myWork.button", "My Work")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="border-t border-border">
                    <Button
                      variant="ghost"
                      className="h-11 w-full justify-between px-0 hover:bg-transparent"
                      onClick={() => setReprimandOpen(true)}
                    >
                      <span className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {t("profile.reprimand.button", "Reprimand")}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </div>
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
                        <p className="text-xs text-muted-foreground">{getRoleDisplayText(organizationRoleForUi)}</p>
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

                  <CreateOrganizationModal open={createOrgOpen} onOpenChange={setCreateOrgOpen} />

                  {/* Create New Organization — modal avoids /create-organization gate (redirects if user already has orgs) */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-9 border-border hover:bg-muted justify-start text-sm"
                    type="button"
                    onClick={() => setCreateOrgOpen(true)}
                  >
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
                  <MyInfoDetailModal open={myInfoOpen} onOpenChange={setMyInfoOpen} profile={profile} />
                  <EmergencyContactDetailModal
                    open={emergencyContactOpen}
                    onOpenChange={setEmergencyContactOpen}
                    contacts={profile.emergencyContacts ?? []}
                  />
                  <FamilyInfoDetailModal
                    open={familyInfoOpen}
                    onOpenChange={setFamilyInfoOpen}
                    members={profile.familyMembers ?? []}
                  />
                  <EducationExperienceDetailModal
                    open={educationExperienceOpen}
                    onOpenChange={setEducationExperienceOpen}
                    employeeId={profile.hasEmployeeRecord ? profile.id : null}
                    hasEmployeeRecord={profile.hasEmployeeRecord}
                  />
                  <PayrollInfoDetailModal
                    open={payrollInfoOpen}
                    onOpenChange={setPayrollInfoOpen}
                    employeeId={profile.hasEmployeeRecord ? profile.id : null}
                    hasEmployeeRecord={profile.hasEmployeeRecord}
                  />
                  <MyFilesDetailModal
                    open={myFilesOpen}
                    onOpenChange={setMyFilesOpen}
                    organizationId={activeOrganizationId}
                    userId={user?.id ?? null}
                    employeeId={profile.hasEmployeeRecord ? profile.id : null}
                  />
                  <MyWorkDetailModal
                    open={myWorkOpen}
                    onOpenChange={setMyWorkOpen}
                    employeeId={profile.hasEmployeeRecord ? profile.id : null}
                    organizationId={activeOrganizationId}
                    userId={user?.id ?? null}
                    hasEmployeeRecord={profile.hasEmployeeRecord}
                  />
                  <ReprimandDetailModal
                    open={reprimandOpen}
                    onOpenChange={setReprimandOpen}
                    employeeId={profile.hasEmployeeRecord ? profile.id : null}
                    organizationId={activeOrganizationId}
                    hasEmployeeRecord={profile.hasEmployeeRecord}
                  />

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