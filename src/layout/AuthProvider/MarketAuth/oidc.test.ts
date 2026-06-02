import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_OIDC_ENDPOINTS } from '@/services/_url';

import { getMarketAuthResultStorageKey } from './handoff';
import { MarketOIDC } from './oidc';

describe('MarketOIDC.buildAuthUrl', () => {
  it('should join market baseUrl with OIDC auth path correctly (no string concat issues)', async () => {
    const client = new MarketOIDC({
      baseUrl: 'https://market.lobehub.com/', // trailing slash on purpose
      clientId: 'lobehub-desktop',
      redirectUri: 'https://market.lobehub.com/lobehub-oidc/callback/desktop',
      scope: 'openid profile email',
    });

    vi.spyOn(client, 'generatePKCEParams').mockResolvedValue({
      codeChallenge: 'code_challenge',
      codeVerifier: 'code_verifier',
      state: 'state_value',
    });

    const url = await client.buildAuthUrl();

    expect(url).toContain('https://market.lobehub.com/lobehub-oidc/auth?');
    expect(url).toContain(`client_id=${encodeURIComponent('lobehub-desktop')}`);
    expect(url).toContain(
      `redirect_uri=${encodeURIComponent('https://market.lobehub.com/lobehub-oidc/callback/desktop')}`,
    );
    expect(url).toContain(`state=${encodeURIComponent('state_value')}`);
    expect(url).toContain(`code_challenge=${encodeURIComponent('code_challenge')}`);

    const parsed = new URL(url);
    expect(parsed.searchParams.get('scope')).toBe('openid profile email');

    // The auth endpoint must be a plain path; it is opened in a real browser.
    expect(MARKET_OIDC_ENDPOINTS.auth).toBe('/lobehub-oidc/auth');
  });
});

describe('MarketOIDC.startAuthorization', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should open the popup before awaiting the auth url to avoid popup blockers', async () => {
    const client = new MarketOIDC({
      baseUrl: 'https://market.lobehub.com',
      clientId: 'lobechat-com',
      redirectUri: 'http://localhost:3010/market-auth-callback',
      scope: 'openid profile email',
    });

    sessionStorage.setItem('market_state', 'state_value');

    let resolveAuthUrl!: (value: string) => void;
    const authUrlPromise = new Promise<string>((resolve) => {
      resolveAuthUrl = resolve;
    });

    vi.spyOn(client, 'buildAuthUrl').mockReturnValue(authUrlPromise);

    let isClosed = false;
    const popup = {
      focus: vi.fn(),
      location: { href: '' },
      get closed() {
        return isClosed;
      },
    } as unknown as Window;

    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    const authPromise = client.startAuthorization();

    expect(openSpy).toHaveBeenCalledWith(
      'about:blank',
      'market_auth',
      'width=580,height=720,scrollbars=yes,resizable=yes',
    );
    expect(openSpy).toHaveBeenCalledTimes(1);

    resolveAuthUrl('https://market.lobehub.com/lobehub-oidc/auth');
    await vi.advanceTimersByTimeAsync(0);

    isClosed = true;
    await vi.advanceTimersByTimeAsync(2000);

    await expect(authPromise).rejects.toMatchObject({
      code: 'popupClosed',
      name: 'MarketAuthError',
    });
  });

  it('should reject promptly when popup closes without a handoff result', async () => {
    const client = new MarketOIDC({
      baseUrl: 'https://market.lobehub.com',
      clientId: 'lobechat-com',
      redirectUri: 'http://localhost:3010/market-auth-callback',
      scope: 'openid profile email',
    });

    sessionStorage.setItem('market_state', 'state_value');
    vi.spyOn(client, 'buildAuthUrl').mockResolvedValue(
      'https://market.lobehub.com/lobehub-oidc/auth',
    );

    let isClosed = false;
    const popup = {
      get closed() {
        return isClosed;
      },
    } as Window;

    vi.spyOn(window, 'open').mockReturnValue(popup);

    const authPromise = client.startAuthorization();
    const rejection = expect(authPromise).rejects.toMatchObject({
      code: 'popupClosed',
      name: 'MarketAuthError',
    });

    isClosed = true;
    await vi.advanceTimersByTimeAsync(2000);

    await rejection;
  });

  it('should resolve from storage handoff when popup closes after callback persistence', async () => {
    const client = new MarketOIDC({
      baseUrl: 'https://market.lobehub.com',
      clientId: 'lobechat-com',
      redirectUri: 'http://localhost:3010/market-auth-callback',
      scope: 'openid profile email',
    });
    const state = 'state_value';
    const storageKey = getMarketAuthResultStorageKey(state);

    sessionStorage.setItem('market_state', state);
    vi.spyOn(client, 'buildAuthUrl').mockResolvedValue(
      'https://market.lobehub.com/lobehub-oidc/auth',
    );

    let isClosed = false;
    const popup = {
      get closed() {
        return isClosed;
      },
    } as Window;

    vi.spyOn(window, 'open').mockReturnValue(popup);

    const authPromise = client.startAuthorization();

    isClosed = true;
    await vi.advanceTimersByTimeAsync(500);

    const payload = JSON.stringify({
      code: 'auth_code',
      state,
      type: 'MARKET_AUTH_SUCCESS',
    });

    localStorage.setItem(storageKey, payload);
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: storageKey,
        newValue: payload,
        storageArea: localStorage,
      }),
    );

    await expect(authPromise).resolves.toEqual({
      code: 'auth_code',
      state,
    });
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
