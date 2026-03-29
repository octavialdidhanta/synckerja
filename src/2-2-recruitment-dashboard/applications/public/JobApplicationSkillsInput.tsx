import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Plus, X } from 'lucide-react';
import { JobApplicationSkill } from '@/2-2-recruitment-dashboard/job-openings/hooks/recruitmentSkillsTypes';

interface JobApplicationSkillsInputProps {
  skills: JobApplicationSkill[];
  onChange: (skills: JobApplicationSkill[]) => void;
  requiredSkills?: Array<{ title: string; skill_level: string; is_required: boolean }>;
  disabled?: boolean;
}

export function JobApplicationSkillsInput({
  skills,
  onChange,
  requiredSkills = [],
  disabled = false
}: JobApplicationSkillsInputProps) {
  const addSkill = () => {
    onChange([...skills, { title: '', level: 'beginner' }]);
  };

  const updateSkill = (index: number, field: keyof JobApplicationSkill, value: string | number) => {
    const newSkills = [...skills];
    newSkills[index] = { ...newSkills[index], [field]: value };
    onChange(newSkills);
  };

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Skills</Label>
        {requiredSkills.length > 0 && (
          <span className="text-xs text-gray-500">
            {requiredSkills.length} required skill{requiredSkills.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Required Skills Display */}
      {requiredSkills.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-900 mb-2">Required Skills:</p>
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((skill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium"
              >
                {skill.title} ({skill.skill_level})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills Input */}
      <div className="space-y-2">
        {skills.map((skill, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Skill name"
                value={skill.title}
                onChange={(e) => updateSkill(index, 'title', e.target.value)}
                disabled={disabled}
                className="h-9"
              />
              <Select
                value={skill.level || skill.skill_level}
                onValueChange={(value) => updateSkill(index, 'level', value)}
                disabled={disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Years"
                value={skill.experience_years || ''}
                onChange={(e) => updateSkill(index, 'experience_years', parseInt(e.target.value) || 0)}
                disabled={disabled}
                className="h-9"
                min="0"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeSkill(index)}
              disabled={disabled}
              className="h-9 w-9 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addSkill}
        disabled={disabled}
        className="w-full"
        size="sm"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Skill
      </Button>
    </div>
  );
}
