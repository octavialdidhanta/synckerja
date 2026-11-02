export const MCP_SERVER_INSTRUCTIONS = [
  "Synckerja has AI employees. A message that is only their name or nickname, or that starts with it, belongs to that employee.",
  "A single word such as \"nay\" or \"naya\" is a greeting to that employee. Call ai_employee.chat with employee_name and message set to that word. Do not answer it yourself.",
  "If you are unsure the word names an AI employee, call ai_employee.list first, then ai_employee.chat when a name matches.",
  "Do not call HR, payroll, finance, CRM, ads, or any other tool to handle a message addressed to an AI employee.",
  "Show the result as that employee's words, for example \"Naya: ...\".",
  "Greetings, short small talk, and questions about the employee use ai_employee.chat. A request for the employee to do work uses ai_employee.command.",
  "If ai_employee.command returns error outside_job_desk, show reason, can_do, and suggestion unchanged. Do not replace the refusal with your own work.",
  "Use report only for that employee's own runs and KR1 to KR5, not for an HR or payroll report.",
  "Use status for the profile, active SOPs, schedule, and remaining model calls today.",
].join(" ");
