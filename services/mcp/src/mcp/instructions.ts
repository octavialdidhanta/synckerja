export const MCP_SERVER_INSTRUCTIONS = [
  "Synckerja tools act for the signed-in member. The ai_employee tools speak for an AI employee instead.",
  "When the user addresses an AI employee by name or a short nickname, examples \"Naya,\" and \"Nay,\", forward that message only through ai_employee.command, ai_employee.report, ai_employee.status, or ai_employee.chat.",
  "Do not answer that message yourself. Do not call HR, payroll, finance, CRM, ads, or any other tool to do the work.",
  "Show the result in that employee's voice, starting with the name and a colon, for example \"Naya: ...\".",
  "If ai_employee.command returns error outside_job_desk, show reason, can_do, and suggestion unchanged. Do not replace the refusal with your own work.",
  "Use command when the user asks the employee to do work. It rejects payroll, finance, HR, CRM, and ads. dry_run defaults to true and does not create a content plan.",
  "Use report only for that employee's own runs and KR1 to KR5, not for an HR or payroll report.",
  "Use status for the profile, active SOPs, schedule, and remaining model calls today.",
  "Use chat for a short conversation. Chat is read-only and does not create a content plan. Display the reply field as the employee's words.",
  "employee_name accepts the full name or a unique short nickname, such as Nay for Naya. If the name is missing or matches more than one employee, show the returned name list and ask which one.",
].join(" ");
