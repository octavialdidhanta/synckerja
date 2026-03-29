
import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EmployeeErrorBoundaryProps {
  error: Error | null;
  onRetry?: () => void;
  employeeId?: string;
}

export const EmployeeErrorBoundary = ({ error, onRetry, employeeId }: EmployeeErrorBoundaryProps) => {
  const navigate = useNavigate();

  const handleBackToEmployees = () => {
    navigate('/employees');
  };

  const isNotFoundError = error?.message?.includes('Employee not found') || 
                         error?.message?.includes('not found');

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isNotFoundError ? 'Employee Not Found' : 'Something went wrong'}
          </h3>
          <p className="text-gray-600 mb-4">
            {isNotFoundError 
              ? "The employee you're looking for doesn't exist or may have been deleted."
              : error?.message || 'An unexpected error occurred while loading employee data.'
            }
          </p>
          {employeeId && (
            <p className="text-sm text-gray-500 mb-4">Employee ID: {employeeId}</p>
          )}
          <div className="space-y-2">
            {!isNotFoundError && onRetry && (
              <Button onClick={onRetry} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button onClick={handleBackToEmployees} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Employees
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
