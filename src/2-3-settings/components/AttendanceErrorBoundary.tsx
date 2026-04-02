
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AttendanceErrorBoundaryProps {
  children?: React.ReactNode;
  error?: Error | null;
  resetError?: () => void;
  fallbackComponent?: React.ReactNode;
}

export const AttendanceErrorBoundary: React.FC<AttendanceErrorBoundaryProps> = ({
  children,
  error,
  resetError,
  fallbackComponent
}) => {
  if (error) {
    const isSchemaError = error.message?.includes('relationship') || 
                         error.message?.includes('schema cache') ||
                         error.message?.includes('PGRST200');

    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }

    return (
      <div className="p-6">
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">
            {isSchemaError ? 'Database Schema Issue' : 'Something went wrong'}
          </AlertTitle>
          <AlertDescription className="text-orange-700 mt-2">
            {isSchemaError ? (
              <>
                The attendance penalties system is not fully configured yet. 
                Some database relationships may need to be established. 
                Please check the migration status or contact your administrator.
              </>
            ) : (
              <>
                An error occurred while loading the attendance data. 
                This might be a temporary issue.
              </>
            )}
          </AlertDescription>
          <div className="mt-4 flex gap-2">
            {resetError && (
              <Button onClick={resetError} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};
