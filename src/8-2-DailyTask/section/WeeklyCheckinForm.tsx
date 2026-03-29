import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { BlockerDisplay } from './BlockerDisplay';
import { useWeekPeriod } from '../hooks/useWeekPeriod';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const WeeklyCheckinForm: React.FC = () => {
  const { weekPeriod, goToPreviousWeek, goToNextWeek, goToCurrentWeek } = useWeekPeriod();
  const { organizationId } = useCurrentOrg();

  if (!weekPeriod || !organizationId) {
    return <div>Loading...</div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Weekly Check-in
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousWeek}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentWeek}
            >
              Current Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextWeek}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Week Period: {weekPeriod.display}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Goals Section */}
        <div className="space-y-2">
          <Label htmlFor="goals">Goals for this week</Label>
          <Textarea
            id="goals"
            className="flex w-full rounded-md border px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-9 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none bg-white"
            placeholder="What are your main goals for this week?"
            rows={3}
          />
        </div>

        {/* Blockers Section */}
        <div className="space-y-2">
          <Label htmlFor="blockers">Blockers</Label>
          <BlockerDisplay
            weekStart={weekPeriod.start}
            weekEnd={weekPeriod.end}
            organizationId={organizationId}
            onBlockerUpdate={() => {
              // Refresh data if needed
            }}
          />
        </div>

        {/* Achievements Section */}
        <div className="space-y-2">
          <Label htmlFor="achievements">Achievements this week</Label>
          <Textarea
            id="achievements"
            className="flex w-full rounded-md border px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-9 text-sm border-gray-300 focus:border-green-500 focus:ring-green-500 resize-none bg-white"
            placeholder="What did you accomplish this week?"
            rows={3}
          />
        </div>

        {/* Challenges Section */}
        <div className="space-y-2">
          <Label htmlFor="challenges">Challenges faced</Label>
          <Textarea
            id="challenges"
            className="flex w-full rounded-md border px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-9 text-sm border-gray-300 focus:border-orange-500 focus:ring-orange-500 resize-none bg-white"
            placeholder="What challenges did you face this week?"
            rows={3}
          />
        </div>

        {/* Next Week Plans */}
        <div className="space-y-2">
          <Label htmlFor="nextWeek">Plans for next week</Label>
          <Textarea
            id="nextWeek"
            className="flex w-full rounded-md border px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-9 text-sm border-gray-300 focus:border-purple-500 focus:ring-purple-500 resize-none bg-white"
            placeholder="What are your plans for next week?"
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button className="bg-blue-600 hover:bg-blue-700">
            Submit Weekly Check-in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

