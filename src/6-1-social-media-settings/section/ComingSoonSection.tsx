import React from 'react';
import { Settings } from 'lucide-react';

export const ComingSoonSection: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Coming Soon</h3>
        <p className="text-muted-foreground">This section is under development</p>
      </div>
    </div>
  );
};
