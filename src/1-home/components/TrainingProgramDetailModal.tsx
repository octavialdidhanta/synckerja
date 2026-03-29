
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { 
  Calendar, 
  Users, 
  MapPin, 
  Clock, 
  GraduationCap, 
  User,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Target,
  CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { LatestTrainingProgram } from '../hooks/useTrainingPrograms';
import { useTrainingParticipants } from '../hooks/useTrainingParticipants';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useTrainingPrograms } from '../hooks/useTrainingPrograms';
import { TrainingRegistrationModal } from './TrainingRegistrationModal';
import { toast } from 'sonner';

interface TrainingProgramDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: LatestTrainingProgram;
}

export const TrainingProgramDetailModal = ({ 
  open, 
  onOpenChange, 
  program 
}: TrainingProgramDetailModalProps) => {
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const { participants, addParticipants } = useTrainingParticipants(program.id);
  const { data: employee } = useCurrentUserEmployee();
  const { programs } = useTrainingPrograms();
  
  // Get full program details from training programs
  const fullProgram = programs.find(p => p.id === program.id);
  
  const availableSlots = program.max_participants - program.participants_count;
  const startDate = format(new Date(program.start_date), 'dd MMM yyyy', { locale: id });
  const endDate = format(new Date(program.end_date), 'dd MMM yyyy', { locale: id });
  
  // Check if current user is already registered (including pending status)
  const isAlreadyRegistered = participants.some(p => 
    p.employee_id === employee?.id && 
    ['registered', 'pending'].includes(p.status)
  );
  const canRegister = availableSlots > 0 && !isAlreadyRegistered && employee;

  // Get user's registration status
  const userParticipant = participants.find(p => p.employee_id === employee?.id);
  const registrationStatus = userParticipant?.status;

  const handleRegisterClick = () => {
    console.log('Opening registration modal');
    setIsRegistrationModalOpen(true);
  };

  const handleRegister = async (reason: string, checklist: any) => {
    if (!employee) {
      toast.error('Employee data tidak ditemukan');
      return;
    }

    try {
      console.log('Registering with reason:', reason, 'checklist:', checklist);
      await addParticipants.mutateAsync({ 
        employeeIds: [employee.id], 
        isDirectRegistration: false,
        registrationReason: reason,
        consentChecklist: checklist
      });
      setIsRegistrationModalOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Gagal mendaftar program training');
      console.error('Registration error:', error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              {program.name}
            </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Tinjau detail program pelatihan, kuota peserta, dan lakukan pendaftaran jika tersedia.
          </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Program Overview */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{startDate} - {endDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span>{program.participants_count}/{program.max_participants} peserta</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>Kategori: {program.category}</span>
                  </div>
                  {program.trainer_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>Trainer: {program.trainer_name}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Slot Tersedia:</span>
                    <Badge variant={availableSlots > 0 ? "default" : "destructive"}>
                      {availableSlots} slot tersisa
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all" 
                      style={{ width: `${(program.participants_count / program.max_participants) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Program Description from Database */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  Deskripsi Program
                </h4>
                {fullProgram?.description ? (
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    {fullProgram.description}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mb-4">
                    Deskripsi program belum tersedia.
                  </p>
                )}

                {/* Objectives */}
                {fullProgram?.objectives && (
                  <div className="mb-4">
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      Tujuan Pelatihan
                    </h5>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {fullProgram.objectives}
                    </p>
                  </div>
                )}

                {/* Requirements */}
                {fullProgram?.requirements && (
                  <div>
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                      Persyaratan
                    </h5>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {fullProgram.requirements}
                    </p>
                  </div>
                )}
                
                {/* Additional Training Info */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Lokasi:</p>
                      <p className="text-xs text-gray-600">
                        {fullProgram?.location || 'Lokasi akan dikonfirmasi'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <GraduationCap className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Metode:</p>
                      <p className="text-xs text-gray-600">Pelatihan interaktif dengan studi kasus</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Registered Participants - Only show approved participants */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Peserta Terdaftar ({participants.filter(p => p.status === 'registered').length})
              </h4>
              
              {participants.filter(p => p.status === 'registered').length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Belum ada peserta yang terdaftar</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {participants.filter(p => p.status === 'registered').map((participant) => (
                    <Card key={participant.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {participant.employee?.full_name || 'Unknown Employee'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {participant.employee?.email}
                            </p>
                            {participant.employee?.department?.name && (
                              <Badge variant="outline" className="text-xs mt-1">
                                {participant.employee.department.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant="default"
                          className="text-xs"
                        >
                          Terdaftar
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Registration Status Info */}
            {registrationStatus === 'pending' && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Status: Menunggu Persetujuan HRD</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-2">
                    Pendaftaran Anda sedang dalam proses review oleh tim HRD.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Registration Requirements Notice */}
            {canRegister && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">Pendaftaran Perlu Persetujuan HRD</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-2">
                    Setelah mengisi form pendaftaran, tim HRD akan meninjau dan memberikan persetujuan.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {registrationStatus === 'pending' ? (
                <>
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span>Pendaftaran sedang menunggu persetujuan</span>
                </>
              ) : registrationStatus === 'registered' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Anda sudah terdaftar dalam program ini</span>
                </>
              ) : registrationStatus === 'rejected' ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>Pendaftaran Anda ditolak</span>
                </>
              ) : availableSlots === 0 ? (
                <>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>Program sudah penuh</span>
                </>
              ) : null}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
              {canRegister && (
                <Button 
                  onClick={handleRegisterClick}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Daftar Program
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrainingRegistrationModal
        open={isRegistrationModalOpen}
        onOpenChange={setIsRegistrationModalOpen}
        programName={program.name}
        onRegister={handleRegister}
        isLoading={addParticipants.isPending}
      />
    </>
  );
};
