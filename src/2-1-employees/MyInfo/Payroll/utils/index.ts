// Payroll Information Page Utilities
// All utility functions used by the /my-info/payroll page

export { devLog } from './devLogger';
export { logger } from './productionLogger';
export {
  formatNpwp,
  stripNpwpDigits,
  NPWP_FORMATTED_MAX_LENGTH,
  NPWP_PLACEHOLDER,
} from './npwpFormat';
