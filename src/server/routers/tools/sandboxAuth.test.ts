import { describe, expect, it, vi } from 'vitest';

import { isTrustedClientEnabled } from '@/libs/trusted-client';

import { getSandboxAuthFailureMessage, isSandboxAuthFailure } from './sandboxAuth';

vi.mock('@/libs/trusted-client', () => ({
  isTrustedClientEnabled: vi.fn(),
}));

const isTrustedClientEnabledMock = vi.mocked(isTrustedClientEnabled);

describe('sandboxAuth', () => {
  it('detects sandbox auth-like failures', () => {
    expect(isSandboxAuthFailure({ code: 'invalid_token' })).toBe(true);
    expect(
      isSandboxAuthFailure({ message: 'Authorization required before sandbox execution.' }),
    ).toBe(true);
    expect(isSandboxAuthFailure({ message: 'python syntax error' })).toBe(false);
  });

  it('returns a trusted-client failure when trusted client is configured', () => {
    isTrustedClientEnabledMock.mockReturnValue(true);

    expect(getSandboxAuthFailureMessage('invalid_token')).toContain(
      'backend trusted-client auth: invalid_token',
    );
  });

  it('returns a server configuration failure when trusted client is missing', () => {
    isTrustedClientEnabledMock.mockReturnValue(false);

    expect(getSandboxAuthFailureMessage('invalid_token')).toContain(
      'MARKET_TRUSTED_CLIENT_ID and MARKET_TRUSTED_CLIENT_SECRET',
    );
  });
});
