
import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { GraduationCap, Calendar, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { LatestTrainingProgram } from './useLatestTrainingPrograms';
import { TrainingProgramDetailModal } from './TrainingProgramDetailModal';

interface TrainingNotificationBannerProps {
  program: LatestTrainingProgram;
}

export const TrainingNotificationBanner = ({ program }: TrainingNotificationBannerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const availableSlots = program.max_participants - program.participants_count;
  const startDate = format(new Date(program.start_date), 'dd MMM yyyy', { locale: id });
  
  const handleRegisterClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-2 rounded-full">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-base mb-1">{program.name}</h4>
              <div className="flex items-center space-x-4 text-xs text-blue-100">
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>Dimulai {startDate}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4" />
                  <span>{availableSlots} slot tersisa</span>
                </div>
                {program.trainer_name && (
                  <span>• Trainer: {program.trainer_name}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-2">
            <Button
              onClick={handleRegisterClick}
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
              size="sm"
            >
              Daftar Sekarang
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-blue-100">Program Training Baru!</p>
          </div>
        </CardContent>
      </Card>

      <TrainingProgramDetailModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        program={program}
      />
    </>
  );
};
