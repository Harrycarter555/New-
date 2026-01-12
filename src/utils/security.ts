// Security utilities
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .substring(0, 500); // Max length
};

export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  if (password.length < 6) errors.push('At least 6 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('One number');
  return errors;
};
