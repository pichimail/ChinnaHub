import { describe, expect, it } from 'vitest';

import { createMarketTrustedUserInfo } from './marketUserInfo';

describe('createMarketTrustedUserInfo', () => {
  it('creates trusted-client user info for signed-in users without email', () => {
    expect(
      createMarketTrustedUserInfo(
        {
          email: null,
          fullName: 'Sandbox User',
          username: 'sandbox-user',
        },
        'user-1',
      ),
    ).toEqual({
      email: '',
      name: 'Sandbox User',
      userId: 'user-1',
    });
  });

  it('returns undefined when the user record is missing', () => {
    expect(createMarketTrustedUserInfo(null, 'user-1')).toBeUndefined();
  });
});
