import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Label } from '@/shared/components/ui/label';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { computeRequiredPlatformsProgress } from '../lib/computeRequiredPlatformsProgress';
import type { RequiredPlatformInput, SocialMediaLinkInput } from '../lib/computeRequiredPlatformsProgress';

type Props = {
  requiredPlatforms: RequiredPlatformInput[];
  links: SocialMediaLinkInput[];
  contentTypeName: string | null;
  showWhenDone?: boolean;
  planDone?: boolean;
};

export function RequiredPlatformsProgress({
  requiredPlatforms,
  links,
  contentTypeName,
  showWhenDone = false,
  planDone = false,
}: Props) {
  if (!showWhenDone && planDone) return null;

  const validation = computeRequiredPlatformsProgress(
    requiredPlatforms,
    links,
    contentTypeName,
  );

  if (validation.totalRequired === 0) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {validation.isValid ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-orange-600" />
          )}
          <Label className="text-sm font-semibold">Required Platforms Progress</Label>
        </div>
        <Badge variant={validation.isValid ? 'default' : 'secondary'} className="shrink-0">
          {validation.filledRequired} / {validation.totalRequired}
        </Badge>
      </div>
      <Progress value={validation.progress} className="mb-2 h-2 [&>div]:bg-blue-600" />
      {validation.missingPlatforms.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto pr-1">
          <p className="mb-1 text-xs font-medium text-orange-700 dark:text-orange-400">
            Missing required platforms:
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-orange-600 dark:text-orange-500">
            {validation.missingPlatforms.map((platform) => (
              <li key={platform}>{platform}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
