import { Badge } from "@/mobile/components/ui/badge";
import { Wifi, WifiOff, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/mobile/components/ui/tooltip";
interface RealtimeStatusProps {
  isConnected: boolean;
  onlineUsers?: number;
  className?: string;
}
export const RealtimeStatusIndicator = ({
  isConnected,
  onlineUsers = 0,
  className = ""
}: RealtimeStatusProps) => {
  return <TooltipProvider>
      <div className={`flex items-center gap-2 ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isConnected ? "Real-time updates aktif - Data akan diperbarui secara otomatis" : "Real-time updates tidak aktif - Refresh manual diperlukan"}
            </p>
          </TooltipContent>
        </Tooltip>

        {isConnected && onlineUsers > 0 && <Tooltip>
            <TooltipTrigger asChild>
              
            </TooltipTrigger>
            <TooltipContent>
              <p>{onlineUsers} pengguna online sekarang</p>
            </TooltipContent>
          </Tooltip>}
      </div>
    </TooltipProvider>;
};