import { Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/mobile/components/ui/avatar";
import { SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface AttendanceHeaderProps {
  userName: string;
  userEmail: string;
  userAvatar?: string;
  onBellClick?: () => void;
}

export const AttendanceHeader = ({ userName, userEmail, userAvatar, onBellClick }: AttendanceHeaderProps) => {
  const { t } = useAppTranslation();

  return (
    <div className="flex items-center justify-between p-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <Avatar className="h-12 w-12">
          <AvatarImage src={userAvatar} alt={userName} />
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-foreground">{userName}</h2>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </div>
      </div>

      {onBellClick && (
        <button
          type="button"
          onClick={onBellClick}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label={t("mobileHome.notificationsTitle", "Notifikasi")}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};
