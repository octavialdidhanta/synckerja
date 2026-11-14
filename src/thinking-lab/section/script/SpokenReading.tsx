import type { VoiceOverScript } from "@/thinking-lab/execution/script";

export function SpokenReading({ script }: { script: VoiceOverScript }) {
  const groups = script.scenes
    .map((scene) => scene.lines.map((line) => line.narration.trim()).filter(Boolean))
    .filter((group) => group.length > 0);
  if (groups.length === 0) return null;
  return (
    <div className="space-y-4">
      {groups.map((group, index) => (
        <div key={index} className="space-y-1">
          {group.map((line, lineIndex) => (
            <p key={`${index}-${lineIndex}`} className="text-sm leading-relaxed text-foreground">
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}