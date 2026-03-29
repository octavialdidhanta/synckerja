
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { X } from 'lucide-react';

interface WorkExperience {
  id: string;
  company_name: string;
  position: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  job_description: string;
}

interface WorkExperienceFormProps {
  experience?: WorkExperience;
  onSave: (experience: WorkExperience | Omit<WorkExperience, 'id'>) => void;
  onCancel: () => void;
}

export function WorkExperienceForm({ experience, onSave, onCancel }: WorkExperienceFormProps) {
  const [formData, setFormData] = useState({
    company_name: experience?.company_name || '',
    position: experience?.position || '',
    location: experience?.location || '',
    start_date: experience?.start_date || '',
    end_date: experience?.end_date || '',
    is_current: experience?.is_current || false,
    job_description: experience?.job_description || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (experience) {
      onSave({ ...experience, ...formData });
    } else {
      onSave(formData);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {experience ? 'Edit Work Experience' : 'Add Work Experience'}
          </h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter company name"
              />
            </div>

            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                Position *
              </label>
              <input
                type="text"
                id="position"
                value={formData.position}
                onChange={(e) => handleChange('position', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter position/job title"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter location"
              />
            </div>

            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                id="start_date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                id="end_date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                disabled={formData.is_current}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_current"
                checked={formData.is_current}
                onChange={(e) => handleChange('is_current', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_current" className="ml-2 text-sm font-medium text-gray-700">
                Currently working here
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="job_description" className="block text-sm font-medium text-gray-700 mb-2">
              Job Description
            </label>
            <textarea
              id="job_description"
              value={formData.job_description}
              onChange={(e) => handleChange('job_description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe your responsibilities and achievements"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
