import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ContentManager } from '../types/social-media';
import type { DigitalMarketingEmployee } from '../hook/useDigitalMarketingEmployees';
import ContentPlannerTab from './EmployeeTarget/ContentPlannerTab';
import ProductionTab from './EmployeeTarget/ProductionTab';
import ContentPostTab from './EmployeeTarget/ContentPostTab';

interface SocialMediaPerformanceTabsProps {
  activePerformanceTab: string;
  setActivePerformanceTab: (tab: string) => void;
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedMonth: Date;
  setSelectedMonth: React.Dispatch<React.SetStateAction<Date>>;
  isCalendarOpen: boolean;
  setIsCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMonthSelectorOpen: boolean;
  setIsMonthSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contentPlanners: ContentManager[];
  creativeProductionMembers: ContentManager[];
  digitalEmployees?: DigitalMarketingEmployee[];
  handleEditTarget: (manager: ContentManager) => void;
  handlePreviousMonth: () => void;
  handleNextMonth: () => void;
}

export const SocialMediaPerformanceTabs: React.FC<SocialMediaPerformanceTabsProps> = ({
  activePerformanceTab,
  setActivePerformanceTab,
  selectedDate,
  setSelectedDate,
  selectedMonth,
  setSelectedMonth,
  isCalendarOpen,
  setIsCalendarOpen,
  isMonthSelectorOpen,
  setIsMonthSelectorOpen,
  contentPlanners,
  creativeProductionMembers,
  digitalEmployees = [],
  handleEditTarget,
  handlePreviousMonth,
  handleNextMonth
}) => {
  return (
    <Tabs value={activePerformanceTab} onValueChange={setActivePerformanceTab} className="w-full">
      <TabsList className="grid h-auto w-full grid-cols-3 gap-0 rounded-md border border-border bg-muted p-0">
        <TabsTrigger
          value="content-planner"
          className="rounded-none border-r border-border py-2.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
        >
          Content Planner
        </TabsTrigger>
        <TabsTrigger
          value="production"
          className="rounded-none border-r border-border py-2.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
        >
          Production
        </TabsTrigger>
        <TabsTrigger
          value="content-post"
          className="rounded-none py-2.5 text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
        >
          Content Post
        </TabsTrigger>
      </TabsList>

      <TabsContent value="content-planner" className="mt-0">
        <ContentPlannerTab
          contentManagers={contentPlanners}
          digitalEmployees={digitalEmployees}
          handleEditTarget={handleEditTarget}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
        />
      </TabsContent>

      <TabsContent value="production" className="mt-0">
        <ProductionTab
          contentManagers={creativeProductionMembers}
          digitalEmployees={digitalEmployees}
          handleEditTarget={handleEditTarget}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
        />
      </TabsContent>

      <TabsContent value="content-post" className="mt-0">
        <ContentPostTab
          contentManagers={contentPlanners}
          handleEditTarget={handleEditTarget}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
        />
      </TabsContent>
    </Tabs>
  );
};
