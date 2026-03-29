
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle, Calendar, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
// import type { SubscriptionStatus } from '../hooks/useSubscription';

// Temporary type definition
interface SubscriptionStatus {
  needs_renewal: boolean;
  is_active: boolean;
  is_trial?: boolean;
  trial_end_date?: string;
  subscription_end_date?: string;
  days_until_expiry?: number;
}

interface SubscriptionBannerProps {
  subscriptionStatus: SubscriptionStatus;
}

export const SubscriptionBanner = ({ subscriptionStatus }: SubscriptionBannerProps) => {
  const navigate = useNavigate();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const expiryDate = subscriptionStatus.is_trial 
    ? subscriptionStatus.trial_end_date 
    : subscriptionStatus.subscription_end_date;

  const daysLeft = subscriptionStatus.days_until_expiry || 0;
  const isUrgent = daysLeft <= 1;

  // Determine the expiry message based on days left
  const getExpiryMessage = () => {
    if (daysLeft < 0) {
      return ' Has Expired!';
    } else if (daysLeft === 0) {
      return ' Expires Today!';
    } else if (daysLeft === 1) {
      return ' Expires Tomorrow!';
    } else {
      return ` Expires in ${daysLeft} days`;
    }
  };

  // Determine the secondary message based on days left
  const getSecondaryMessage = () => {
    if (daysLeft < 0) {
      return subscriptionStatus.is_trial ? 'Trial ended' : 'Subscription expired';
    } else {
      return subscriptionStatus.is_trial ? 'Trial ends' : 'Subscription expires';
    }
  };

  return (
    <Alert className={`m-0 border-l-4 rounded-none border-t-0 border-r-0 border-b shadow-sm ${
      isUrgent 
        ? 'border-l-red-500 bg-red-50 border-red-200' 
        : 'border-l-orange-500 bg-orange-50 border-orange-200'
    }`}>
      <AlertTriangle className={`h-4 w-4 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`} />
      <AlertDescription className="flex items-center justify-between w-full py-2">
        <div className="flex items-center gap-3">
          <div>
            <p className={`font-semibold text-sm ${isUrgent ? 'text-red-800' : 'text-orange-800'}`}>
              {subscriptionStatus.is_trial ? 'Trial Period' : 'Subscription'} 
              {getExpiryMessage()}
            </p>
            <p className={`text-xs ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
              <Calendar className="inline h-3 w-3 mr-1" />
              {getSecondaryMessage()} on {expiryDate && formatDate(expiryDate)}
            </p>
          </div>
        </div>
        
        <Button
          onClick={() => {
            console.log('🚀 Banner Button Clicked: Navigating to /subscription');
            navigate('/subscription');
          }}
          size="sm"
          className={`${
            isUrgent 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-orange-600 hover:bg-orange-700'
          } text-white`}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {subscriptionStatus.is_trial ? 'Choose Plan' : 'Renew Now'}
        </Button>
      </AlertDescription>
    </Alert>
  );
};


