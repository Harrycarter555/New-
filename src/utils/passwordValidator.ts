// src/utils/passwordValidator.ts

export interface PasswordValidationResult {
  isValid: boolean;
  message: string;
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number; // 0-100 score
  issues: string[];
}

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  const issues: string[] = [];
  let score = 0;
  
  // Empty check
  if (!password || password.trim().length === 0) {
    return {
      isValid: false,
      message: 'Password is required',
      strength: 'weak',
      score: 0,
      issues: ['Password cannot be empty']
    };
  }

  // 1. Length checks
  if (password.length < 6) {
    issues.push('Must be at least 6 characters long');
  } else if (password.length < 8) {
    issues.push('For better security, use at least 8 characters');
    score += 20;
  } else if (password.length >= 12) {
    score += 40;
  } else {
    score += 30;
  }

  // 2. Character variety checks
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUpperCase) issues.push('Add at least one uppercase letter (A-Z)');
  if (!hasLowerCase) issues.push('Add at least one lowercase letter (a-z)');
  if (!hasNumbers) issues.push('Add at least one number (0-9)');
  if (!hasSpecialChar) issues.push('Add at least one special character (!@#$%^&*)');

  // Score based on character types
  let typeCount = 0;
  if (hasUpperCase) { typeCount++; score += 15; }
  if (hasLowerCase) { typeCount++; score += 15; }
  if (hasNumbers) { typeCount++; score += 15; }
  if (hasSpecialChar) { typeCount++; score += 20; }

  // Bonus for multiple character types
  if (typeCount === 4) score += 10;
  if (typeCount === 3) score += 5;

  // 3. Check for common weak passwords
  const weakPasswords = [
    'password', '123456', 'qwerty', 'admin', 'welcome', 'password123',
    'test123', 'hello123', 'abc123', 'letmein', 'monkey', '12345678',
    '123456789', '123123', '111111', 'sunshine', 'iloveyou'
  ];

  if (weakPasswords.includes(password.toLowerCase())) {
    score = 0;
    issues.push('This is a very common and weak password');
  }

  // 4. Check for repeated patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    issues.push('Avoid repeated characters (e.g., aaa, 111)');
  }

  // 5. Check for sequential patterns
  if (/123|234|345|456|567|678|789|987|876|765|654|543|432|321/.test(password)) {
    score -= 10;
    issues.push('Avoid simple number sequences');
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine strength and message
  let strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  let message: string;

  if (score >= 80 && password.length >= 12 && typeCount >= 3) {
    strength = 'very-strong';
    message = 'Excellent! Very strong password';
  } else if (score >= 60 && password.length >= 8 && typeCount >= 3) {
    strength = 'strong';
    message = 'Strong password';
  } else if (score >= 40 && password.length >= 6 && typeCount >= 2) {
    strength = 'medium';
    message = 'Medium strength password';
  } else {
    strength = 'weak';
    message = 'Weak password - needs improvement';
  }

  // Final validation
  const isValid = password.length >= 6 && 
                  score >= 40 && 
                  hasUpperCase && 
                  hasLowerCase && 
                  hasNumbers;

  return {
    isValid,
    message,
    strength,
    score,
    issues: isValid ? [] : issues
  };
};

// Helper function for password strength color
export const getPasswordStrengthColor = (strength: string): string => {
  switch (strength) {
    case 'very-strong': return '#10b981'; // emerald
    case 'strong': return '#3b82f6'; // blue
    case 'medium': return '#f59e0b'; // amber
    case 'weak': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
};

// Quick validation for forms
export const isPasswordValid = (password: string): boolean => {
  if (!password || password.length < 6) return false;
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumbers;
};
