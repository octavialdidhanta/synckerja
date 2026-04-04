import { Check } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  subtitle: string;
}

interface WizardProgressProps {
  steps: Step[];
  currentStep: number;
}

export const WizardProgress = ({ steps, currentStep }: WizardProgressProps) => {
  return (
    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200">
      <div className="flex items-center justify-between max-w-2xl mx-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center">
              {/* Step Circle */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200
                ${currentStep > step.id 
                  ? 'bg-green-600 text-white' 
                  : currentStep === step.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-slate-200 text-slate-500'
                }
              `}>
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </div>
              
              {/* Step Info */}
              <div className="ml-3">
                <div className={`text-sm font-medium ${
                  currentStep >= step.id ? 'text-slate-900' : 'text-slate-500'
                }`}>
                  {step.title}
                </div>
                <div className="text-xs text-slate-500">
                  {step.subtitle}
                </div>
              </div>
            </div>
            
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className={`
                h-px w-16 mx-4 transition-all duration-200
                ${currentStep > step.id ? 'bg-green-600' : 'bg-slate-200'}
              `} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
