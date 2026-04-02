
import React from 'react';
import { TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';

export const CompanyFilesTableHeader = () => {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="w-[280px] whitespace-nowrap font-semibold text-foreground">File Name</TableHead>
        <TableHead className="w-[120px] whitespace-nowrap font-semibold text-foreground">Category</TableHead>
        <TableHead className="w-[100px] whitespace-nowrap font-semibold text-foreground">Size</TableHead>
        <TableHead className="w-[100px] whitespace-nowrap font-semibold text-foreground">Type</TableHead>
        <TableHead className="w-[120px] whitespace-nowrap font-semibold text-foreground">Visibility</TableHead>
        <TableHead className="w-[150px] whitespace-nowrap font-semibold text-foreground">Owner</TableHead>
        <TableHead className="w-[120px] whitespace-nowrap font-semibold text-foreground">Upload Date</TableHead>
        <TableHead className="w-[100px] whitespace-nowrap font-semibold text-foreground">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};


