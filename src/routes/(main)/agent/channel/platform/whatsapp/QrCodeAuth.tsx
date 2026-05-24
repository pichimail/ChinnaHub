'use client';

import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, type ButtonProps, Modal, QRCode, Spin, Typography } from 'antd';
import { QrCode, RefreshCw } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';

import { agentBotProviderService } from '@/services/agentBotProvider';

const QR_POLL_INTERVAL_MS = 2000;

interface WhatsAppQrCodeAuthProps {
  buttonLabel?: string;
  buttonType?: ButtonProps['type'];
  currentSessionId?: string;
  onAuthenticated: (credentials: {
    sessionId: string;
    sessionState: string;
    userId: string;
  }) => void;
}

const WhatsAppQrCodeAuth = memo<WhatsAppQrCodeAuthProps>(
  ({ buttonLabel, buttonType = 'primary', currentSessionId, onAuthenticated }) => {
    const [open, setOpen] = useState(false);
    const [qr, setQr] = useState<string>();
    const [sessionId, setSessionId] = useState<string>();
    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(false);
    const pollingRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stopPolling = useCallback(() => {
      pollingRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    const startQrFlow = useCallback(async () => {
      setLoading(true);
      setError(undefined);
      setStatus('');
      setQr(undefined);
      stopPolling();

      try {
        const result = await agentBotProviderService.whatsappGetQrCode(currentSessionId);
        setQr(result.qr);
        setSessionId(result.sessionId);
        setStatus(result.status);
        setLoading(false);

        pollingRef.current = true;
        const poll = async () => {
          if (!pollingRef.current) return;

          try {
            const res = await agentBotProviderService.whatsappPollQrStatus(result.sessionId);
            if (!pollingRef.current) return;

            setStatus(res.status);
            if (res.qr) setQr(res.qr);

            if (res.status === 'connected' && res.sessionState) {
              stopPolling();
              onAuthenticated({
                sessionId: result.sessionId,
                sessionState: res.sessionState,
                userId: res.userId || result.sessionId,
              });
              setOpen(false);
              return;
            }

            if (res.status === 'failed' || res.status === 'expired') {
              stopPolling();
              setError(res.error || 'WhatsApp QR connection failed');
              return;
            }

            timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS);
          } catch {
            if (pollingRef.current) timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS);
          }
        };

        timerRef.current = setTimeout(poll, QR_POLL_INTERVAL_MS);
      } catch (err: any) {
        setError(err?.message || 'Failed to get WhatsApp QR code');
        setLoading(false);
      }
    }, [currentSessionId, onAuthenticated, stopPolling]);

    const handleOpen = useCallback(() => {
      setOpen(true);
      startQrFlow();
    }, [startQrFlow]);

    const handleClose = useCallback(() => {
      stopPolling();
      setOpen(false);
    }, [stopPolling]);

    const statusText =
      status === 'qr'
        ? 'Scan this QR code in WhatsApp to connect.'
        : status === 'connecting'
          ? 'Waiting for WhatsApp confirmation...'
          : status === 'connected'
            ? 'WhatsApp connected.'
            : '';

    return (
      <>
        <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button icon={<QrCode size={16} />} type={buttonType} onClick={handleOpen}>
            {buttonLabel || 'Scan QR Code to Connect'}
          </Button>
          <Typography.Text style={{ maxWidth: 520, textAlign: 'center' }} type="secondary">
            <InfoCircleOutlined style={{ marginInlineEnd: 4 }} />
            WhatsApp QR mode uses a WhatsApp Web session. Keep the linked device active for reliable
            delivery.
          </Typography.Text>
        </div>

        <Modal
          centered
          footer={null}
          open={open}
          title="Connect WhatsApp"
          width={460}
          onCancel={handleClose}
        >
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '16px 0',
            }}
          >
            {loading && <Spin size="large" />}
            {qr && !error && <QRCode size={240} value={qr} />}
            {sessionId && !error && (
              <Typography.Text type="secondary">Session: {sessionId}</Typography.Text>
            )}
            {statusText && !error && (
              <Typography.Text type="secondary">{statusText}</Typography.Text>
            )}
            {error && (
              <>
                <Alert showIcon message={error} type="warning" />
                <Button icon={<RefreshCw size={14} />} onClick={startQrFlow}>
                  Refresh QR
                </Button>
              </>
            )}
          </div>
        </Modal>
      </>
    );
  },
);

WhatsAppQrCodeAuth.displayName = 'WhatsAppQrCodeAuth';

export default WhatsAppQrCodeAuth;
