
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Mail, Shield, Key, CheckCircle, Briefcase } from 'lucide-react';

interface InviteStepProps {
  formData: any;
}

export const InviteAccessStep = ({ formData }: InviteStepProps) => {
  return (
    <ScrollArea className="h-[600px] pr-4">
      <div className="space-y-6">
        {/* Access Level - Simplified */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5" />
              System Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="font-semibold">Assigned Role:</p>
                <Badge variant={formData.role ? 'default' : 'secondary'} className="mt-1">
                  {formData.role || 'employee'}
                </Badge>
              </div>
              <Briefcase className="h-8 w-8 text-blue-600" />
            </div>
            
            {formData.role && (
              <div className="mt-4 p-3 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Access Level:</h4>
                {formData.role === 'admin' && (
                  <p className="text-sm text-red-700">Full system access including user management and organization settings.</p>
                )}
                {formData.role === 'hr' && (
                  <p className="text-sm text-orange-700">Employee management and HR functions.</p>
                )}
                {formData.role === 'manager' && (
                  <p className="text-sm text-blue-700">Team management and department reporting.</p>
                )}
                {formData.role === 'employee' && (
                  <p className="text-sm text-green-700">Personal profile access and basic functions.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Magic Link Info - Condensed */}
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-800">
              <Mail className="h-5 w-5" />
              Magic Link Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="text-green-800">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Secure one-click login via email</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">No password required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">24-hour secure token expiry</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice - Compact */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-600" />
              <div className="text-gray-700">
                <p className="font-semibold text-sm">Security Features:</p>
                <p className="text-xs mt-1">One-time tokens, email verification, and role-based access control ensure secure account setup.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};
