// utils/passwordValidator.ts

export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
  strength: 'weak' | 'medium' | 'strong';
}

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  if (!password) {
    return {
      isValid: false,
      message: 'Password is required',
      strength: 'weak'
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters',
      strength: 'weak'
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let message = '';

  if (hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && password.length >= 8) {
    strength = 'strong';
    message = 'Strong password';
  } else if ((hasUpperCase || hasLowerCase) && hasNumbers && password.length >= 6) {
    strength = 'medium';
    message = 'Medium password';
  } else {
    message = 'Weak password. Include uppercase, lowercase, numbers and special characters';
  }

  return {
    isValid: password.length >= 6,
    message,
    strength
  };
};
