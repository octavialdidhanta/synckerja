import React, { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Upload, X, File } from "lucide-react";

interface FileUploadProps {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string | null) => void;
  accept?: string;
  required?: boolean;
  maxSize?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  id,
  label,
  value,
  onChange,
  accept = "*",
  required = false,
  maxSize = 5 * 1024 * 1024,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.size > maxSize) {
      setError(`File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    setIsUploading(true);

    try {
      const base64 = await convertToBase64(file);
      onChange(base64);
    } catch (err) {
      console.error("Error processing file:", err);
      setError("Error processing file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
    });
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    onChange(null);
    setError(null);
  };

  const getFileName = () => {
    if (!value) return null;
    return "Uploaded file";
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          id={id}
          onChange={handleFileSelect}
          className="hidden"
          accept={accept}
        />

        {!value ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="h-20 w-full border-2 border-dashed"
          >
            <div className="flex flex-col items-center gap-2">
              {isUploading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {isUploading ? "Uploading..." : "Click to upload or drag and drop"}
              </span>
            </div>
          </Button>
        ) : (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{getFileName()}</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
};
