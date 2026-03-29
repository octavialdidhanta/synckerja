
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Upload, X, FileText } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';

interface CVUploadSectionProps {
  cvFile: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function CVUploadSection({ cvFile, onFileChange, disabled = false }: CVUploadSectionProps) {
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or Word document",
          variant: "destructive"
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 5MB",
          variant: "destructive"
        });
        return;
      }
      
      onFileChange(file);
      toast({
        title: "File selected",
        description: `${file.name} has been selected for upload`,
      });
    }
  };

  const removeFile = () => {
    onFileChange(null);
    // Reset the input value
    const input = document.getElementById('cv') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  };

  return (
    <div>
      <Label htmlFor="cv">Upload CV/Resume *</Label>
      <div className="mt-1">
        <input
          id="cv"
          type="file"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx"
          className="hidden"
          disabled={disabled}
        />
        
        {cvFile ? (
          <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">{cvFile.name}</p>
                  <p className="text-sm text-green-600">
                    {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                disabled={disabled}
                className="text-green-600 hover:text-green-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => !disabled && document.getElementById('cv')?.click()}
            className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors ${
              disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer hover:border-gray-400'
            }`}
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">Click to upload your CV/Resume</p>
            <p className="text-sm text-gray-500 mt-1">PDF, DOC, or DOCX (max 5MB)</p>
          </div>
        )}
      </div>
    </div>
  );
}
