const STRICT_ADMIN_EMAIL = 'pichimail24@gmail.com';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isStrictAdminEmail = (email?: string | null) => {
  if (!email) return false;

  return normalizeEmail(email) === STRICT_ADMIN_EMAIL;
};
