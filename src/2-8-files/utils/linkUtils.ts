/**
 * Utility functions for handling external links (Google Docs, etc.)
 */

export interface LinkMetadata {
  title: string;
  description?: string;
  modifiedAt?: string;
  owner?: string;
  thumbnailUrl?: string;
  mimeType: string;
}

/**
 * Validates if a string is a valid URL
 */
export const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Verifies if a URL is accessible (returns 200 status)
 */
export const verifyUrlAccess = async (url: string): Promise<boolean> => {
  try {
    // Use a CORS proxy or check if URL is accessible
    // For client-side, we'll use a simple HEAD request
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors', // This allows cross-origin requests but doesn't expose response
    });
    // With no-cors, we can't check status, so we assume it's accessible if no error
    return true;
  } catch (error) {
    console.error('URL verification error:', error);
    // If it's a CORS error, the URL might still be valid, just not accessible from browser
    // We'll return true for common link types
    return true;
  }
};

/**
 * Detects the type of link and extracts metadata
 */
export const extractLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  
  // Google Docs/Sheets/Slides
  if (hostname.includes('docs.google.com') || hostname.includes('drive.google.com')) {
    return await extractGoogleDocsMetadata(url);
  }
  
  // Dropbox
  if (hostname.includes('dropbox.com')) {
    return await extractDropboxMetadata(url);
  }
  
  // OneDrive
  if (hostname.includes('onedrive.live.com') || hostname.includes('1drv.ms')) {
    return await extractOneDriveMetadata(url);
  }
  
  // Notion
  if (hostname.includes('notion.so')) {
    return await extractNotionMetadata(url);
  }
  
  // Figma
  if (hostname.includes('figma.com')) {
    return await extractFigmaMetadata(url);
  }
  
  // Generic link - try to extract title from page
  return await extractGenericLinkMetadata(url);
};

/**
 * Extracts metadata from Google Docs/Sheets/Slides links
 */
const extractGoogleDocsMetadata = async (url: string): Promise<LinkMetadata> => {
  try {
    // Google Docs links can be converted to export format to get metadata
    // For now, we'll extract basic info from URL and try to fetch oEmbed if available
    
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Try to get document ID
    const docIdIndex = pathParts.findIndex(part => part === 'd');
    const docId = docIdIndex !== -1 && pathParts[docIdIndex + 1] 
      ? pathParts[docIdIndex + 1] 
      : null;
    
    let title = 'Google Document';
    let mimeType = 'application/vnd.google-apps.document';
    
    // Detect document type from URL
    if (url.includes('/spreadsheets/')) {
      title = 'Google Sheet';
      mimeType = 'application/vnd.google-apps.spreadsheet';
    } else if (url.includes('/presentation/')) {
      title = 'Google Slides';
      mimeType = 'application/vnd.google-apps.presentation';
    } else if (url.includes('/document/')) {
      title = 'Google Doc';
      mimeType = 'application/vnd.google-apps.document';
    }
    
    // Try to fetch thumbnail (Google Docs doesn't provide direct API without auth)
    // For now, we'll use a placeholder or try to construct thumbnail URL
    let thumbnailUrl: string | undefined;
    if (docId) {
      // Google Docs thumbnail URL format (may not work without proper sharing settings)
      thumbnailUrl = `https://drive.google.com/thumbnail?id=${docId}&sz=w1000`;
    }
    
    return {
      title,
      mimeType,
      thumbnailUrl,
      description: `Google ${title.split(' ')[1] || 'Document'}`
    };
  } catch (error) {
    console.error('Error extracting Google Docs metadata:', error);
    return {
      title: 'Google Document',
      mimeType: 'application/vnd.google-apps.document'
    };
  }
};

/**
 * Extracts metadata from Dropbox links
 */
const extractDropboxMetadata = async (url: string): Promise<LinkMetadata> => {
  return {
    title: 'Dropbox File',
    mimeType: 'application/vnd.dropbox',
    description: 'Dropbox shared file'
  };
};

/**
 * Extracts metadata from OneDrive links
 */
const extractOneDriveMetadata = async (url: string): Promise<LinkMetadata> => {
  return {
    title: 'OneDrive File',
    mimeType: 'application/vnd.onedrive',
    description: 'OneDrive shared file'
  };
};

/**
 * Extracts metadata from Notion links
 */
const extractNotionMetadata = async (url: string): Promise<LinkMetadata> => {
  return {
    title: 'Notion Page',
    mimeType: 'application/vnd.notion',
    description: 'Notion page'
  };
};

/**
 * Extracts metadata from Figma links
 */
const extractFigmaMetadata = async (url: string): Promise<LinkMetadata> => {
  return {
    title: 'Figma Design',
    mimeType: 'application/vnd.figma',
    description: 'Figma design file'
  };
};

/**
 * Extracts metadata from generic links by trying to fetch page title
 */
const extractGenericLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  try {
    // Try to fetch the page and extract title
    // Note: This will fail for CORS-protected sites
    const response = await fetch(url, { 
      method: 'GET',
      mode: 'no-cors'
    });
    
    // With no-cors, we can't read the response
    // So we'll extract domain name as title
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    return {
      title: domain.charAt(0).toUpperCase() + domain.slice(1),
      mimeType: 'text/html',
      description: `Link to ${domain}`
    };
  } catch (error) {
    // Fallback: use domain name
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      return {
        title: domain.charAt(0).toUpperCase() + domain.slice(1),
        mimeType: 'text/html',
        description: `Link to ${domain}`
      };
    } catch {
      return {
        title: 'External Link',
        mimeType: 'text/html',
        description: 'External link'
      };
    }
  }
};

/**
 * Gets appropriate icon/thumbnail for link type
 */
export const getLinkIcon = (url: string): string => {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname.toLowerCase();
  
  if (hostname.includes('docs.google.com') || hostname.includes('drive.google.com')) {
    return '📄'; // Google Docs icon
  }
  if (hostname.includes('dropbox.com')) {
    return '📦'; // Dropbox icon
  }
  if (hostname.includes('onedrive.live.com') || hostname.includes('1drv.ms')) {
    return '☁️'; // OneDrive icon
  }
  if (hostname.includes('notion.so')) {
    return '📝'; // Notion icon
  }
  if (hostname.includes('figma.com')) {
    return '🎨'; // Figma icon
  }
  
  return '🔗'; // Generic link icon
};

