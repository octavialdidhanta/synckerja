import React, { useState } from 'react';
import { Heart, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { useMotivations } from './ModalMotivationForm/useMotivations';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useToast } from '@/shared/components/ui/use-toast';

interface MotivationLikeButtonProps {
  motivation: any;
}

export const MotivationLikeButton = ({ motivation }: MotivationLikeButtonProps) => {
  const [isLiking, setIsLiking] = useState(false);
  const { toggleLike } = useMotivations();
  const { data: employeeData } = useCurrentUserEmployee();
  const { toast } = useToast();

  const likesCount = motivation.likes_count || 0;
  const likes = motivation.likes || [];
  
  // Check if current user has liked this motivation
  const hasLiked = likes.some((like: any) => like.employee_id === employeeData?.id);

  const handleLike = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      const isNowLiked = await toggleLike(motivation.id);
      toast({
        title: isNowLiked ? "Liked!" : "Unliked",
        description: isNowLiked ? "You liked this motivation" : "You unliked this motivation",
      });
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        disabled={isLiking}
        className={`h-6 px-1 ${hasLiked ? 'text-red-500 hover:text-red-600' : 'text-white/70 hover:text-white'}`}
      >
        <Heart className={`h-3 w-3 ${hasLiked ? 'fill-current' : ''}`} />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1 text-white/70 hover:text-white text-xs"
          >
            {likesCount}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" side="bottom" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Users className="h-4 w-4" />
              Disukai oleh {likesCount} {likesCount === 1 ? 'orang' : 'orang'}
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {likesCount === 0 ? (
                <div className="text-xs text-muted-foreground">
                  Belum ada yang menyukai motivasi ini
                </div>
              ) : (
                likes.map((like: any) => (
                  <div key={like.id} className="text-xs text-muted-foreground flex items-center gap-1">
                    <Heart className="h-3 w-3 text-red-500 fill-current" />
                    {like.employee?.full_name || 'Karyawan'}
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};