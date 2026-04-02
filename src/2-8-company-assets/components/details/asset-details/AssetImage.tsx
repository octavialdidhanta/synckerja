import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface AssetImageProps {
  imageUrl?: string;
  assetName: string;
}

export const AssetImage = ({ imageUrl, assetName }: AssetImageProps) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!imageUrl) return null;

  return (
    <>
      <div className="flex justify-center mb-3">
        <img
          src={imageUrl}
          alt={assetName}
          className="max-w-full max-h-96 w-auto h-auto object-contain rounded-lg border cursor-pointer hover:opacity-90 transition-opacity shadow-md"
          onClick={() => setIsPreviewOpen(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
          title="Click to view larger image"
        />
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-4 bg-black/95" hideCloseButton>
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-2 top-2 z-10 h-10 w-10 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={imageUrl}
              alt={assetName}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
