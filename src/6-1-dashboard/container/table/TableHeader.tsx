
import React from 'react';

export const TableHeader: React.FC = () => {
  return (
    <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
      <tr>
        {/* Checkbox */}
        <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          No
        </th>

        {/* Post Date */}
        <th style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Post Date
        </th>

        {/* PIC */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          PIC
        </th>

        {/* Content Type */}
        <th style={{ width: '144px', minWidth: '144px', maxWidth: '144px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Content Type
        </th>

        {/* Service */}
        <th style={{ width: '144px', minWidth: '144px', maxWidth: '144px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Service
        </th>

        {/* Sub Service */}
        <th style={{ width: '144px', minWidth: '144px', maxWidth: '144px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Sub Service
        </th>

        {/* Title */}
        <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Title
        </th>

        {/* Content Pillar */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Content Pillar
        </th>

        {/* Brief */}
        <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Brief
        </th>

        {/* Status */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Status
        </th>

        {/* Revision Count */}
        <th style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Revision
        </th>

        {/* Approved */}
        <th style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Approved
        </th>

        {/* Completion Date */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Completion Date
        </th>

        {/* PIC Production */}
        <th style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          PIC Production
        </th>

        {/* Google Drive Link */}
        <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Google Drive Link
        </th>

        {/* Production Status */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Production Status
        </th>

        {/* Production Revision Count */}
        <th style={{ width: '96px', minWidth: '96px', maxWidth: '96px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Prod Revision
        </th>

        {/* Production Approved */}
        <th style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Prod Approved
        </th>

        {/* Production Completion Date */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Prod Completion
        </th>

        {/* Production Approved Date */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Prod Approved Date
        </th>

        {/* Post Link */}
        <th style={{ width: '280px', minWidth: '280px', maxWidth: '280px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Post Link
        </th>

        {/* PIC POST */}
        <th style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          PIC POST
        </th>

        {/* Done */}
        <th style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Done
        </th>

        {/* Actual Post Date */}
        <th style={{ width: '128px', minWidth: '128px', maxWidth: '128px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          Actual Post Date
        </th>

        {/* On Time Status */}
        <th style={{ width: '128px', minWidth: '128px', maxWidth: '128px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-300 bg-gray-50 border-b-2 border-gray-300">
          On Time Status
        </th>

        {/* Status Content */}
        <th style={{ width: '160px', minWidth: '160px', maxWidth: '160px' }} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 border-b-2 border-gray-300">
          Status Content
        </th>
      </tr>
    </thead>
  );
};
