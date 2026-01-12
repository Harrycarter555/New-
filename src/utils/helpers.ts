// Password strength calculator (existing)
export const getPasswordStrength = (pass: string) => {
  if (!pass) return { score: 0, label: 'NONE', color: 'bg-slate-800' };
  
  let score = 0;
  if (pass.length > 5) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  if (pass.length > 9) score++;

  const strengths = [
    { score: 0, label: 'VERY WEAK', color: 'bg-red-600' },
    { score: 1, label: 'WEAK', color: 'bg-red-500' },
    { score: 2, label: 'FAIR', color: 'bg-orange-500' },
    { score: 3, label: 'GOOD', color: 'bg-cyan-500' },
    { score: 4, label: 'STRONG', color: 'bg-green-500' }
  ];

  return strengths[score] || strengths[0];
};

// NEW: Format currency
export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

// NEW: Format date
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// NEW: Truncate text
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
