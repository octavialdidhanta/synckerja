
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { ExternalLink, Key, MapPin, Shield, CheckCircle } from 'lucide-react';

export const GoogleMapsSetup = () => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null);

  const handleValidateKey = async () => {
    if (!apiKey.trim()) return;
    
    setIsValidating(true);
    try {
      // Simple validation by trying to load Google Maps with the key
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      
      script.onload = () => {
        setValidationResult('success');
        setIsValidating(false);
        // Clean up
        document.head.removeChild(script);
      };
      
      script.onerror = () => {
        setValidationResult('error');
        setIsValidating(false);
        // Clean up
        document.head.removeChild(script);
      };
      
      document.head.appendChild(script);
    } catch (error) {
      setValidationResult('error');
      setIsValidating(false);
    }
  };

  const steps = [
    {
      title: 'Create Google Cloud Project',
      description: 'Go to Google Cloud Console and create a new project or select existing one',
      link: 'https://console.cloud.google.com/projectselector2'
    },
    {
      title: 'Enable APIs',
      description: 'Enable Maps JavaScript API and Places API for your project',
      link: 'https://console.cloud.google.com/apis/library'
    },
    {
      title: 'Create API Key',
      description: 'Go to Credentials and create a new API key',
      link: 'https://console.cloud.google.com/apis/credentials'
    },
    {
      title: 'Restrict API Key',
      description: 'Set HTTP referrers restriction for security (add your domain)',
      link: null
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Google Maps API Setup
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure Google Maps integration for accurate location-based attendance
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Setup Steps */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Setup Steps
            </h3>
            <div className="grid gap-3">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{step.title}</h4>
                    <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                    {step.link && (
                      <a
                        href={step.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                      >
                        Open in Google Cloud Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Enter Your API Key
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="apiKey">Google Maps API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Google Maps API key..."
                  className="flex-1"
                />
                <Button
                  onClick={handleValidateKey}
                  disabled={!apiKey.trim() || isValidating}
                  variant="outline"
                >
                  {isValidating ? 'Validating...' : 'Test'}
                </Button>
              </div>
            </div>

            {validationResult === 'success' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  API key is valid! Google Maps integration is ready to use.
                </AlertDescription>
              </Alert>
            )}

            {validationResult === 'error' && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  API key validation failed. Please check your key and make sure the required APIs are enabled.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security:</strong> Make sure to restrict your API key to your domain only to prevent unauthorized usage.
              Add your domain (e.g., yourdomain.com) to the HTTP referrers restriction.
            </AlertDescription>
          </Alert>

          {/* Required APIs */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Required APIs to Enable:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Maps JavaScript API (for map display)</li>
              <li>• Places API (for address search and autocomplete)</li>
              <li>• Geocoding API (for address validation)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
