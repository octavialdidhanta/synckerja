import React, { useRef } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useDailyTask } from '../DailyTaskContext';

interface FileUploadProps {
  taskId: string;
}

export const FileUpload = ({ taskId }: FileUploadProps) => {
  const { uploadTaskFile } = useDailyTask();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    try {
      await uploadTaskFile(taskId, file);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar,.wav,.mp3,.m4a,.aac,.ogg,.flac,.mp4,.avi,.mov,.wmv,.flv,.webm,.mkv,.m4v"
      />
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleUploadClick}
        disabled={isUploading}
        className="text-blue-600 hover:text-blue-700"
      >
        {isUploading ? (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Upload className="w-4 h-4" />
            Upload File
          </div>
        )}
      </Button>
    </div>
  );
};





