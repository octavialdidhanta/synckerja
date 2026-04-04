
import { ContentPlan } from '../../../types/social-media';

export const validateRequiredFields = (planData: ContentPlan) => {
  const missingFields = [];
  
  // Column 4: Content Type
  if (!planData.content_type_id) {
    missingFields.push('Content Type');
  }
  
  // Column 5: Service
  if (!planData.service_id) {
    missingFields.push('Service');
  }
  
  // Column 6: Sub Service
  if (!planData.sub_service_id) {
    missingFields.push('Sub Service');
  }
  
  // Column 7: Title
  if (!planData.title || planData.title.trim() === '') {
    missingFields.push('Title');
  }
  
  // Column 8: Content Pillar
  if (!planData.content_pillar_id) {
    missingFields.push('Content Pillar');
  }
  
  // Column 9: Brief
  if (!planData.brief || planData.brief.trim() === '') {
    missingFields.push('Brief');
  }
  
  return missingFields;
};
