
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, Users, CreditCard, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { SubscriptionStatus } from "@/10-subscription/hooks/useOptimizedSubscription";

interface SubscriptionWarningBannerProps {
  subscriptionStatus: SubscriptionStatus;
  className?: string;
  showDismiss?: boolean;
}

export const SubscriptionWarningBanner = ({ 
  subscriptionStatus, 
  className = "",
  showDismiss = false 
}: SubscriptionWarningBannerProps) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !subscriptionStatus.over_limit) return null;

  const excessEmployees = subscriptionStatus.current_employees - 1000;
  const isAtLimit = excessEmployees === 0;

  return (
    <Alert className={`border-l-4 border-l-red-500 bg-red-50 border-red-200 ${className}`}>
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4 text-red-600" />
          <div>
            <p className="font-semibold text-red-800">
              {isAtLimit ? 'Employee Limit Reached' : 'Employee Limit Exceeded'}
            </p>
            <p className="text-sm text-red-600">
              You have {subscriptionStatus.current_employees} employees and your {subscriptionStatus.plan_name} plan allows 1000. 
              {isAtLimit 
                ? ' You cannot add more employees without upgrading.'
                : ` You are ${excessEmployees} employee${excessEmployees > 1 ? 's' : ''} over limit.`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/subscription')}
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Upgrade Now
          </Button>
          {showDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};


