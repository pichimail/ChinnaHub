import { isTrustedClientEnabled } from '@/libs/trusted-client';

const TRUSTED_CLIENT_CONFIG_ERROR_MESSAGE =
  'Cloud Sandbox requires Market trusted-client configuration. Set MARKET_TRUSTED_CLIENT_ID and MARKET_TRUSTED_CLIENT_SECRET to run sandbox tools without separate Market OIDC authorization.';

const TRUSTED_CLIENT_AUTH_FAILURE_PREFIX =
  'Cloud Sandbox authentication failed through backend trusted-client auth';

interface SandboxAuthFailure {
  code?: string;
  message?: string;
}

export const isSandboxAuthFailure = ({ code, message }: SandboxAuthFailure): boolean => {
  const normalizedCode = code?.toLowerCase();
  const normalizedMessage = message?.toLowerCase() || '';

  return (
    normalizedCode === 'invalid_token' ||
    normalizedCode === 'token_expired' ||
    normalizedCode === 'unauthorized' ||
    normalizedMessage.includes('invalid_token') ||
    normalizedMessage.includes('token expired') ||
    normalizedMessage.includes('unauthorized') ||
    normalizedMessage.includes('authorization required') ||
    normalizedMessage.includes('authentication required') ||
    normalizedMessage.includes('market authorization')
  );
};

export const getSandboxAuthFailureMessage = (message?: string): string => {
  if (!isTrustedClientEnabled()) return TRUSTED_CLIENT_CONFIG_ERROR_MESSAGE;

  return message
    ? `${TRUSTED_CLIENT_AUTH_FAILURE_PREFIX}: ${message}`
    : TRUSTED_CLIENT_AUTH_FAILURE_PREFIX;
};
