import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  enforceUserFeatureAccess,
  getManagedApiKey,
  getManagedEnvVar,
} from '@/server/services/admin/runtimeGovernance';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const KIE_UPLOAD_API_BASE_URL = 'https://kieai.redpandaai.co';

const JsonPayloadSchema = z.record(z.string(), z.any()).default({});

const audioActionProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const access = await enforceUserFeatureAccess(opts.ctx.serverDB, {
    flagKey: 'ai_audio',
    label: 'Audio actions',
    userId: opts.ctx.userId,
  });

  if (!access.allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: access.reason || 'Audio actions are not available for your plan',
    });
  }

  return opts.next();
});

const getKieApiKey = async (db: any) => {
  const [managedKey, managedEnvKey] = await Promise.all([
    getManagedApiKey(db, 'audio_generation'),
    getManagedEnvVar(db, 'KIE_AI_API_KEY', 'audio'),
  ]);
  const apiKey = managedKey || managedEnvKey || process.env.KIE_AI_API_KEY;

  if (!apiKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Audio provider API key is not configured in admin or environment',
    });
  }

  return apiKey;
};

const requestKie = async <T = unknown>({
  apiKey,
  baseUrl = KIE_API_BASE_URL,
  method = 'POST',
  path,
  payload,
  query,
}: {
  apiKey: string;
  baseUrl?: string;
  method?: 'GET' | 'POST';
  path: string;
  payload?: Record<string, unknown>;
  query?: Record<string, string | undefined>;
}): Promise<T> => {
  const url = new URL(`${baseUrl}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    body: method === 'POST' ? JSON.stringify(payload || {}) : undefined,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: `Audio provider error: ${response.status} ${response.statusText}`,
      cause: data,
    });
  }

  return data as T;
};

const postAction = (path: string) =>
  audioActionProcedure
    .input(
      z.object({
        payload: JsonPayloadSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getKieApiKey(ctx.serverDB);
      return requestKie({ apiKey, path, payload: input.payload });
    });

const getAction = (path: string, queryKeys: string[]) =>
  audioActionProcedure
    .input(z.object({ query: z.record(z.string(), z.string().optional()).default({}) }))
    .query(async ({ ctx, input }) => {
      const apiKey = await getKieApiKey(ctx.serverDB);
      const query = Object.fromEntries(
        queryKeys.map((key) => [key, input.query[key]] as const),
      ) as Record<string, string | undefined>;

      return requestKie({ apiKey, method: 'GET', path, query });
    });

export const audioActionRouter = router({
  addInstrumental: postAction('/generate/add-instrumental'),
  addVocals: postAction('/generate/add-vocals'),
  boostStyle: postAction('/style/generate'),
  checkVoiceAvailability: postAction('/voice/check-voice'),
  convertDownloadUrl: postAction('/common/download-url'),
  createCustomVoice: postAction('/voice/generate'),
  extendMusic: postAction('/generate/extend'),
  generateMashup: postAction('/generate/mashup'),
  generateMusicCover: postAction('/suno/cover/generate'),
  generatePersona: postAction('/generate/generate-persona'),
  getCredit: getAction('/chat/credit', []),
  getCustomVoiceRecords: getAction('/voice/record-info', ['taskId']),
  getMusicDetails: getAction('/generate/record-info', ['taskId']),
  getTimestampedLyrics: postAction('/generate/get-timestamped-lyrics'),
  getVoiceVerificationPhrase: getAction('/voice/validate-info', ['taskId']),
  regenerateVoiceVerificationPhrase: postAction('/voice/regenerate'),
  replaceSection: postAction('/generate/replace-section'),
  separateVocals: postAction('/vocal-removal/generate'),
  uploadAndCoverAudio: postAction('/generate/upload-cover'),
  uploadAndExtendAudio: postAction('/generate/upload-extend'),
  uploadFileFromBase64: audioActionProcedure
    .input(z.object({ payload: JsonPayloadSchema }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getKieApiKey(ctx.serverDB);
      return requestKie({
        apiKey,
        baseUrl: KIE_UPLOAD_API_BASE_URL,
        path: '/api/file-stream-upload',
        payload: input.payload,
      });
    }),
  voiceGenerateVerificationPhrase: postAction('/voice/validate'),
});
