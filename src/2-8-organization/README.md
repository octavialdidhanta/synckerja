# Company Organization Module

This module contains all components related to the Company Organization page (`/company/organization`).

## Structure

```
2_8_organization/
├── CompanyOrganizationPage.tsx    # Main organization page
│
├── organization/                  # Organization components
│   ├── OrganizationalChart.tsx    # Organization chart visualization
│   ├── OrganizationalDiagram.tsx  # Hierarchical diagram
│   └── OrganizationStatistics.tsx # Statistics and metrics
│
├── index.ts                       # Module exports
└── README.md                      # This file
```

## Components

### CompanyOrganizationPage
Main page component for viewing organization structure.

**Features:**
- Organization chart visualization
- Department hierarchy display
- Employee count per department
- Organization statistics
- Interactive chart navigation

### OrganizationalChart
Interactive organization chart component.

**Features:**
- Hierarchical tree view
- Department nodes with employee count
- Manager/head display
- Expand/collapse departments
- Zoom and pan controls
- Export chart to image

**Props:**
- `departments`: Array of departments with hierarchy
- `onNodeClick`: Callback when department node clicked
- `expandAll`: Boolean to expand all nodes

### OrganizationalDiagram
Visual diagram of organization structure.

**Features:**
- Vertical or horizontal layout
- Department cards with details
- Employee avatars
- Connection lines between departments
- Department color coding
- Responsive layout

**Props:**
- `data`: Organization hierarchy data
- `layout`: 'vertical' | 'horizontal'
- `showEmployees`: Boolean to show employee list

### OrganizationStatistics
Statistics cards showing organization metrics.

**Metrics:**
- Total Departments
- Total Employees
- Average Team Size
- Largest Department
- Smallest Department
- Department Distribution Chart

**Props:**
- `departments`: Array of departments
- `employees`: Array of employees

## Data Structure

### Department Hierarchy
```typescript
interface Department {
  id: string;
  name: string;
  parent_id?: string | null;
  head_id?: string | null;
  description?: string;
  employee_count: number;
  children?: Department[];
}
```

### Employee Structure
```typescript
interface Employee {
  id: string;
  full_name: string;
  job_position_name?: string;
  department_name?: string;
  department_id?: string;
  profile_image?: string;
}
```

## Features

### Organization Chart
- **Interactive Visualization**: Click and drag to navigate
- **Department Details**: Hover to see department info
- **Employee Count**: Shows number of employees per department
- **Hierarchy Levels**: Visual representation of reporting structure
- **Search**: Find departments quickly
- **Export**: Save chart as image

### Organization Statistics
- **Real-time Metrics**: Updated from live data
- **Department Analysis**: Size, distribution, growth
- **Visual Charts**: Pie charts, bar charts for distribution
- **Comparison**: Compare departments by size, growth
- **Trends**: Historical organization changes

## Usage

```tsx
import { CompanyOrganizationPage } from '@/components/1_halaman/2_8_organization';

// In Company.tsx
<TabsContent value="organization">
  <CompanyOrganizationPage />
</TabsContent>
```

## Integration Points

- **Routing:** `/company/organization`
- **Database:** Uses `departments` and `employees` tables
- **Hooks:** 
  - `useDepartments` - Fetch all departments
  - `useEmployees` - Fetch employee data
  - `useEmployeeDepartments` - Department with employee counts
- **Permissions:** Requires access to company organization page

## Database Schema

### departments table
- `id`: UUID primary key
- `organization_id`: UUID foreign key
- `name`: Department name
- `parent_id`: Parent department (for hierarchy)
- `head_id`: Department head (employee)
- `description`: Department description
- `created_at`, `updated_at`: Timestamps

### employees table
- `id`: UUID primary key
- `department_id`: Department assignment
- `full_name`: Employee name
- `job_position_name`: Position
- Other employee fields...

## Visualization Libraries

This module may use:
- **React Flow** - For interactive org charts
- **D3.js** - For custom visualizations
- **Recharts** - For statistics charts
- **vis.js** - For network diagrams

## Future Enhancements

- [ ] Drag and drop to reorganize departments
- [ ] Department creation from chart
- [ ] Employee assignment from org view
- [ ] Department comparison tool
- [ ] Organization change history
- [ ] Export to various formats (PDF, Excel, PNG)
- [ ] Print-friendly view
- [ ] Mobile-optimized chart
- [ ] Department budgets in org chart
- [ ] Employee skills mapping
- [ ] Succession planning view
- [ ] Cross-department collaboration view
- [ ] Real-time collaboration (multi-user editing)
- [ ] Department goals/OKRs integration
- [ ] Org chart templates
- [ ] AI-suggested restructuring

## Styling

- Uses Tailwind CSS for styling
- Responsive design for mobile/tablet/desktop
- Light/dark theme support
- Customizable department colors
- Print-friendly styles

## Performance

- **Lazy Loading**: Only load visible chart nodes
- **Virtualization**: For large organizations
- **Memoization**: Prevent unnecessary re-renders
- **Optimized Queries**: Efficient database queries
- **Caching**: Cache organization data

## Accessibility

- Keyboard navigation support
- Screen reader compatible
- ARIA labels for chart elements
- High contrast mode support
- Focus indicators



