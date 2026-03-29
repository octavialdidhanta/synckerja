
import { Mail } from 'lucide-react';

interface StepHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isPersonalValid: boolean;
  isEmploymentValid: boolean;
  isInviteValid: boolean;
}

export const StepHeader = ({
  activeTab,
  onTabChange,
  isPersonalValid,
  isEmploymentValid,
  isInviteValid
}: StepHeaderProps) => {
  return (
    <div className="mb-6">
      {/* Magic Link System Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>Magic Link System:</strong> This process will create complete employee data and send a Magic Link to the employee's email. 
          Employees can login directly through the link in their email without needing a password. The system will automatically create an account and profile for the new employee.
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button 
          onClick={() => onTabChange('personal')} 
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'personal' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Personal Data
        </button>
        <button 
          onClick={() => onTabChange('employment')} 
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'employment' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`} 
          disabled={!isPersonalValid}
        >
          Employment Data
        </button>
        <button 
          onClick={() => onTabChange('invite')} 
          className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === 'invite' 
              ? 'bg-white text-blue-600 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`} 
          disabled={!isEmploymentValid}
        >
          Employee Access
        </button>
      </div>
    </div>
  );
};
