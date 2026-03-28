export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

export const validateEmailFormat = (email: string): EmailValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: "Format email tidak valid" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split("@")[1];

  const commonDomainTypos: Record<string, string> = {
    "gmail.co": "gmail.com",
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmail.cm": "gmail.com",
    "yahoo.co": "yahoo.com",
    "yahoo.cm": "yahoo.com",
    "hotmai.com": "hotmail.com",
    "hotmal.com": "hotmail.com",
  };

  if (commonDomainTypos[domain]) {
    const suggestedEmail = normalizedEmail.replace(domain, commonDomainTypos[domain]);
    return {
      isValid: false,
      error: "Kemungkinan ada typo di domain email",
      suggestion: suggestedEmail,
    };
  }

  if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) {
    return { isValid: false, error: "Domain email tidak valid" };
  }

  return { isValid: true };
};

export const sanitizeEmail = (email: string): string => email.trim().toLowerCase();
