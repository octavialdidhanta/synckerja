import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Globe, ExternalLink, Eye, FileText } from 'lucide-react';

interface LinkPreviewPanelProps {
  brief: string;
}

export const LinkPreviewPanel: React.FC<LinkPreviewPanelProps> = ({ brief }) => {
  // Extract URLs from brief content for preview
  const extractUrls = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  // Convert Google Docs sharing link to embed link
  const getGoogleDocsEmbedUrl = (url: string): string => {
    if (url.includes('docs.google.com/document')) {
      const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      if (docIdMatch) {
        return `https://docs.google.com/document/d/${docIdMatch[1]}/preview`;
      }
    }
    return url;
  };

  const urls = extractUrls(brief);
  const googleDocsUrls = urls.filter(url => url.includes('docs.google.com'));
  const otherUrls = urls.filter(url => !url.includes('docs.google.com'));

  return (
    <div className="h-full w-full p-4">
      {urls.length > 0 ? (
        <div className="h-full flex flex-col space-y-4">
          {/* Google Docs Preview */}
          {googleDocsUrls.map((url, index) => (
            <div key={`gdocs-${index}`} className="flex-1 border rounded-lg overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 p-3 bg-blue-50 border-b flex-shrink-0">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm text-blue-800">Google Document {index + 1}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto"
                  onClick={() => window.open(url, '_blank')}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 bg-white">
                <iframe
                  src={getGoogleDocsEmbedUrl(url)}
                  className="w-full h-full border-0"
                  title={`Google Doc Preview ${index + 1}`}
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              </div>
            </div>
          ))}

          {/* Other Links */}
          {otherUrls.map((url, index) => (
            <div key={`other-${index}`} className="flex-1 border rounded-lg overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 p-3 bg-gray-50 border-b flex-shrink-0">
                <Globe className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-sm text-gray-700">Link {index + 1}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto"
                  onClick={() => window.open(url, '_blank')}
                  title="Open link in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <div className="p-3 bg-white flex-shrink-0">
                <p className="text-xs text-gray-600 break-all font-mono">{url}</p>
              </div>
              <div className="flex-1 bg-white border-t">
                <iframe
                  src={url}
                  className="w-full h-full border-0"
                  title={`Preview ${index + 1}`}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <Eye className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium mb-1">No Links Found</p>
            <p className="text-xs">Add URLs to your brief content to preview them here</p>
          </div>
        </div>
      )}
    </div>
  );
};
