
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { MapPin, Phone, Mail, Calendar, Building, Camera } from 'lucide-react';
import { Employee } from '@/shared/hooks/employees/useEmployees';
import { FileUpload } from '@/shared/components/ui/file-upload';
import { useUpdateEmployee } from '../../hooks';
import { useState, useEffect } from 'react';

interface EmployeeDetailSidebarProps {
  employee: Employee;
}

const getInitials = (name: string) => {
  return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

export const EmployeeDetailSidebar = ({
  employee
}: EmployeeDetailSidebarProps) => {
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string | null>(null);
  const { mutate: updateEmployee } = useUpdateEmployee();

  // Update local photo URL when employee data changes
  useEffect(() => {
    setCurrentPhotoUrl(employee.profile_photo_url);
  }, [employee.profile_photo_url]);

  const handlePhotoUpload = (photoUrl: string | undefined) => {
    console.log('Photo uploaded:', photoUrl);
    
    // Immediately update local state to show the photo
    setCurrentPhotoUrl(photoUrl || null);
    
    // Update the employee record
    updateEmployee({
      id: employee.id,
      data: { profile_photo_url: photoUrl }
    }, {
      onSuccess: () => {
        console.log('Employee photo updated successfully');
        // Force a small delay to ensure the photo is properly processed
        setTimeout(() => {
          setCurrentPhotoUrl(photoUrl || null);
        }, 100);
      }
    });
    
    setShowPhotoUpload(false);
  };

  const getPhotoUrl = (photoPath: string | null) => {
    if (!photoPath) return null;
    // Use the full Supabase URL for photo display
    return `https://najgdwffjhnqlogfrlqa.supabase.co/storage/v1/object/public/employee-documents/${photoPath}`;
  };

  // Use currentPhotoUrl for display, fallback to employee.profile_photo_url
  const displayPhotoUrl = getPhotoUrl(currentPhotoUrl || employee.profile_photo_url);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-primary/5 to-white">
      {/* Employee Profile */}
      <div className="p-6 text-center border-b border-gray-200">
        <div className="relative mb-4">
          <Avatar className="h-24 w-24 mx-auto">
            {displayPhotoUrl ? (
              <AvatarImage 
                src={displayPhotoUrl}
                alt={employee.full_name}
                className="object-cover"
                key={currentPhotoUrl || employee.profile_photo_url} // Force re-render when photo changes
              />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
              {getInitials(employee.full_name)}
            </AvatarFallback>
          </Avatar>
          <Button
            size="sm"
            variant="outline"
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-white border-2 border-primary/20 hover:bg-primary/5 rounded-full p-2"
            onClick={() => setShowPhotoUpload(!showPhotoUpload)}
          >
            <Camera className="h-3 w-3 text-primary" />
          </Button>
        </div>

        {showPhotoUpload && (
          <div className="mb-4">
            <FileUpload
              id="employee-photo"
              label="Upload Photo"
              value={(currentPhotoUrl || employee.profile_photo_url) ?? ''}
              onChange={handlePhotoUpload}
              accept=".jpg,.jpeg,.png"
              maxSize={2 * 1024 * 1024} // 2MB
            />
          </div>
        )}

        <h3 className="text-xl font-bold text-gray-900 mb-1">{employee.full_name}</h3>
        <p className="text-sm text-gray-600 mb-2">{employee.job_position_name || 'Employee'}</p>
        <Badge variant={employee.status === 'active' ? 'default' : 'secondary'} className={`${employee.status === 'active' ? 'bg-green-100 text-green-800' : ''}`}>
          {employee.status || 'Active'}
        </Badge>
      </div>

      {/* Quick Info */}
      <div className="p-6 space-y-4 flex-1">
        {/* This component is now just for the employee profile display */}
        {/* Navigation is handled by individual pages */}
      </div>
    </div>
  );
};
