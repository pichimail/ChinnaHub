import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { TRPCError } from '@trpc/server';

const sessions = new Map<
  string,
  {
    error?: string;
    qr?: string;
    sessionDir: string;
    sessionState?: string;
    sock?: any;
    status: 'connecting' | 'connected' | 'expired' | 'failed' | 'qr';
    userId?: string;
  }
>();

const SESSION_ROOT = path.join(process.cwd(), '.runtime', 'whatsapp-sessions');

const loadBaileys = async () => {
  try {
    const importer = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<any>;
    return await importer('@whiskeysockets/baileys');
  } catch (error) {
    throw new TRPCError({
      cause: error,
      code: 'PRECONDITION_FAILED',
      message: 'WhatsApp QR mode requires @whiskeysockets/baileys to be installed.',
    });
  }
};

export const startWhatsAppQrSession = async (existingSessionId?: string) => {
  const sessionId = existingSessionId || randomUUID();
  const sessionDir = path.join(SESSION_ROOT, sessionId);
  await mkdir(sessionDir, { recursive: true });

  const baileys = await loadBaileys();
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionDir);
  const sock = baileys.default({
    auth: state,
    printQRInTerminal: false,
  });

  sessions.set(sessionId, { sessionDir, sock, status: 'connecting' });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update: any) => {
    const current = sessions.get(sessionId);
    if (!current) return;

    if (update.qr) {
      sessions.set(sessionId, { ...current, qr: update.qr, status: 'qr' });
      return;
    }

    if (update.connection === 'open') {
      sessions.set(sessionId, {
        ...current,
        sessionState: sessionDir,
        status: 'connected',
        userId: sock.user?.id || sessionId,
      });
      return;
    }

    if (update.connection === 'close') {
      sessions.set(sessionId, {
        ...current,
        error: update.lastDisconnect?.error?.message,
        status: 'failed',
      });
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  const current = sessions.get(sessionId);

  return {
    qr: current?.qr || '',
    sessionId,
    status: current?.status || 'connecting',
  };
};

export const pollWhatsAppQrSession = async (sessionId: string) => {
  const current = sessions.get(sessionId);
  if (!current) {
    return { error: 'Session not found or expired', sessionId, status: 'expired' as const };
  }

  return {
    error: current.error,
    qr: current.qr,
    sessionId,
    sessionState: current.sessionState,
    status: current.status,
    userId: current.userId,
  };
};
