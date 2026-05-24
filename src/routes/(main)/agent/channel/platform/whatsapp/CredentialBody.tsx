'use client';

import { memo, useCallback } from 'react';

import type { PlatformCredentialBodyProps } from '../types';
import WhatsAppQrCodeAuth from './QrCodeAuth';

const CredentialBody = memo<PlatformCredentialBodyProps>(
  ({ currentConfig, hasConfig, onAuthenticated }) => {
    const handleQrAuthenticated = useCallback(
      (creds: { sessionId: string; sessionState: string; userId: string }) => {
        onAuthenticated?.({
          applicationId: creds.sessionId,
          credentials: {
            phoneNumberId: creds.userId || creds.sessionId,
            sessionId: creds.sessionId,
            sessionState: creds.sessionState,
          },
        });
      },
      [onAuthenticated],
    );

    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
        <WhatsAppQrCodeAuth
          currentSessionId={hasConfig ? currentConfig?.applicationId : undefined}
          onAuthenticated={handleQrAuthenticated}
        />
      </div>
    );
  },
);

CredentialBody.displayName = 'WhatsAppCredentialBody';

export default CredentialBody;
