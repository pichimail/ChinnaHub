import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TRPCError } from '@trpc/server';

const SESSION_STARTUP_WAIT_MS = 10_000;
const SESSION_STARTUP_POLL_MS = 250;

type WhatsAppQrStatus = 'connecting' | 'connected' | 'expired' | 'failed' | 'qr';

const sessions = new Map<
  string,
  {
    error?: string;
    qr?: string;
    sessionDir: string;
    sessionState?: string;
    sock?: any;
    status: WhatsAppQrStatus;
    userId?: string;
    ownerUserId: string;
    updatedAt: number;
  }
>();

const SESSION_ROOT = path.join(process.cwd(), '.runtime', 'whatsapp-sessions');
const SESSION_REGISTRY_FILE = path.join(SESSION_ROOT, 'registry.json');

type PersistedSession = {
  error?: string;
  id: string;
  ownerUserId: string;
  qr?: string;
  sessionDir: string;
  sessionState?: string;
  status: WhatsAppQrStatus;
  updatedAt: number;
  userId?: string;
};

let persistedSessions = new Map<string, PersistedSession>();
let persistenceHydrated = false;

const now = () => Date.now();

const toPersisted = (
  sessionId: string,
  value: {
    error?: string;
    ownerUserId: string;
    qr?: string;
    sessionDir: string;
    sessionState?: string;
    status: WhatsAppQrStatus;
    updatedAt: number;
    userId?: string;
  },
): PersistedSession => ({
  error: value.error,
  id: sessionId,
  ownerUserId: value.ownerUserId,
  qr: value.qr,
  sessionDir: value.sessionDir,
  sessionState: value.sessionState,
  status: value.status,
  updatedAt: value.updatedAt,
  userId: value.userId,
});

const saveRegistry = async () => {
  await mkdir(SESSION_ROOT, { recursive: true });
  const payload = JSON.stringify(Array.from(persistedSessions.values()), null, 2);
  await writeFile(SESSION_REGISTRY_FILE, payload, 'utf8');
};

const loadRegistry = async () => {
  if (persistenceHydrated) return;
  persistenceHydrated = true;

  await mkdir(SESSION_ROOT, { recursive: true });

  try {
    const raw = await readFile(SESSION_REGISTRY_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedSession[];

    if (!Array.isArray(parsed)) return;

    persistedSessions = new Map(parsed.map((s) => [s.id, s]));
  } catch {
    // First boot or corrupted registry should not block QR flow.
    persistedSessions = new Map();
  }
};

const persistSession = async (
  sessionId: string,
  value: {
    error?: string;
    ownerUserId: string;
    qr?: string;
    sessionDir: string;
    sessionState?: string;
    status: WhatsAppQrStatus;
    updatedAt: number;
    userId?: string;
  },
) => {
  persistedSessions.set(sessionId, toPersisted(sessionId, value));
  await saveRegistry();
};

const findUserActiveSession = (ownerUserId: string): PersistedSession | undefined => {
  const candidates = Array.from(persistedSessions.values()).filter(
    (s) => s.ownerUserId === ownerUserId && (s.status === 'connecting' || s.status === 'qr'),
  );

  if (candidates.length === 0) return undefined;

  return candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
};

const expireSession = async (sessionId: string, reason?: string) => {
  const current = sessions.get(sessionId);

  if (current?.sock) {
    try {
      current.sock.end?.(new Error('QR session expired'));
    } catch {
      // ignore socket teardown errors
    }
  }

  if (current) {
    const next = {
      ...current,
      error: reason || current.error,
      status: 'expired' as const,
      updatedAt: now(),
    };

    sessions.set(sessionId, next);
    await persistSession(sessionId, next);
    return;
  }

  const persisted = persistedSessions.get(sessionId);
  if (persisted) {
    const next = {
      ...persisted,
      error: reason || persisted.error,
      status: 'expired' as const,
      updatedAt: now(),
    };
    persistedSessions.set(sessionId, next);
    await saveRegistry();
  }
};

const waitForInitialState = async (sessionId: string) => {
  const startedAt = now();

  while (now() - startedAt < SESSION_STARTUP_WAIT_MS) {
    const current = sessions.get(sessionId);
    if (!current) return;

    if (current.status === 'qr' || current.status === 'connected' || current.status === 'failed') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_STARTUP_POLL_MS));
  }
};

const loadBaileys = async () => {
  try {
    return await import('@whiskeysockets/baileys');
  } catch (error) {
    throw new TRPCError({
      cause: error,
      code: 'PRECONDITION_FAILED',
      message: 'WhatsApp QR mode requires @whiskeysockets/baileys to be installed.',
    });
  }
};

export const startWhatsAppQrSession = async (ownerUserId: string, existingSessionId?: string) => {
  await loadRegistry();

  let sessionId: string | undefined;
  const existingPersisted = existingSessionId
    ? persistedSessions.get(existingSessionId)
    : undefined;
  if (existingPersisted && existingPersisted.ownerUserId === ownerUserId) {
    sessionId = existingPersisted.id;
  }

  if (!sessionId) {
    sessionId = findUserActiveSession(ownerUserId)?.id;
  }

  if (!sessionId) {
    sessionId = randomUUID();
  }

  // Keep one active pending session per user.
  const staleSessions = Array.from(persistedSessions.values()).filter(
    (s) =>
      s.ownerUserId === ownerUserId &&
      s.id !== sessionId &&
      (s.status === 'connecting' || s.status === 'qr'),
  );

  for (const stale of staleSessions) {
    await expireSession(stale.id, 'Replaced by a newer QR session');
  }

  const sessionDir = path.join(SESSION_ROOT, sessionId);
  await mkdir(sessionDir, { recursive: true });

  const baileys = await loadBaileys();
  const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionDir);
  const sock = baileys.default({
    auth: state,
    printQRInTerminal: false,
  });

  const baseState = {
    ownerUserId,
    sessionDir,
    sock,
    status: 'connecting' as const,
    updatedAt: now(),
  };

  sessions.set(sessionId, baseState);
  await persistSession(sessionId, baseState);

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update: any) => {
    const current = sessions.get(sessionId);
    if (!current) return;

    if (update.qr) {
      const next = {
        ...current,
        qr: update.qr,
        status: 'qr' as const,
        updatedAt: now(),
      };
      sessions.set(sessionId, next);
      await persistSession(sessionId, next);
      return;
    }

    if (update.connection === 'open') {
      const next = {
        ...current,
        sessionState: sessionDir,
        status: 'connected' as const,
        updatedAt: now(),
        userId: sock.user?.id || sessionId,
      };
      sessions.set(sessionId, next);
      await persistSession(sessionId, next);
      return;
    }

    if (update.connection === 'close') {
      const next = {
        ...current,
        error: update.lastDisconnect?.error?.message,
        status: 'failed' as const,
        updatedAt: now(),
      };

      sessions.set(sessionId, next);
      await persistSession(sessionId, next);
    }
  });

  await waitForInitialState(sessionId);
  const current = sessions.get(sessionId);

  return {
    qr: current?.qr || '',
    sessionId,
    status: current?.status || 'connecting',
  };
};

export const pollWhatsAppQrSession = async (ownerUserId: string, sessionId: string) => {
  await loadRegistry();

  const runtimeSession = sessions.get(sessionId);
  if (runtimeSession && runtimeSession.ownerUserId !== ownerUserId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to access this QR session' });
  }

  const current = runtimeSession || persistedSessions.get(sessionId);
  if (!current) {
    return { error: 'Session not found or expired', sessionId, status: 'expired' as const };
  }

  if (current.ownerUserId !== ownerUserId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed to access this QR session' });
  }

  if (!runtimeSession && (current.status === 'connecting' || current.status === 'qr')) {
    await expireSession(sessionId, 'QR session expired. Please refresh and scan again.');
    return {
      error: 'QR session expired. Please refresh and scan again.',
      sessionId,
      status: 'expired' as const,
    };
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
