
import React from 'react';

interface AssetNotesProps {
  notes?: string;
}

export const AssetNotes = ({ notes }: AssetNotesProps) => {
  if (!notes) return null;

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">Notes</label>
      <p className="rounded-lg bg-muted/50 p-2 text-sm text-foreground">{notes}</p>
    </div>
  );
};
