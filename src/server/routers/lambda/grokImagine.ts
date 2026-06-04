import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { enforceUserFeatureAccess, getManagedApiKey, getManagedEnvVar } from '@/server/services/admin/runtimeGovernance';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';

const payloadSchema = z.record(z.string(), z.any()).default({});

type GrokMode = 'text-to-image' | 'image-to-image' | 'image-to-video' | 'text-to-video' | 'extend' | 'upscale' | 'preview';

const kiePathByMode: Record<GrokMode, string> = {
  'extend': '/grok-imagine/extend',
  'image-to-image': '/grok-imagine/image-to-image',
  'image-to-video': '/grok-imagine/image-to-video',
  'preview': '/grok-imagine/1-5-preview',
  'text-to-image': '/grok-imagine/text-to-image',
  'text-to-video': '/grok-imagine/text-to-video',
  'upscale': '/grok-imagine/upscale',
};

const grokProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const access = await enforceUserFeatureAccess(opts.ctx.serverDB, {
    flagKey: 'ai_grok_imagine',
    label: 'Chinna image and video providers',
    userId: opts.ctx.userId,
  });

  if (!access.allowed) {
    throw new TRPCError({ code: 'FORBIDDEN', message: access.reason || 'Provider disabled' });
  }

  return opts.next();
});

const getKey = async (db: any, key: 'kie' | 'openrouter') => {
  const service = key === 'kie' ? 'grok_imagine' : 'openrouter';
  const envKey = key === 'kie' ? 'KIE_AI_API_KEY' : 'OPENROUTER_API_KEY';
  const [managedKey, managedEnvKey] = await Promise.all([
    getManagedApiKey(db, service),
    getManagedEnvVar(db, envKey, key === 'kie' ? 'image' : 'provider'),
  ]);
  const value = managedKey || managedEnvKey || process.env[envKey];
  if (!value) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `${envKey} is not configured` });
  return value;
};

const requestJson = async ({ apiKey, baseUrl, path, payload }: { apiKey: string; baseUrl: string; path: string; payload: Record<string, unknown> }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new TRPCError({ code: 'BAD_GATEWAY', message: `Provider error: ${response.status}`, cause: data });
  return data;
};

export const grokImagineRouter = router({
  runKie: grokProcedure.input(z.object({ mode: z.enum(['text-to-image', 'image-to-image', 'image-to-video', 'text-to-video', 'extend', 'upscale', 'preview']), payload: payloadSchema })).mutation(async ({ ctx, input }) => {
    const apiKey = await getKey(ctx.serverDB, 'kie');
    return requestJson({ apiKey, baseUrl: KIE_API_BASE_URL, path: kiePathByMode[input.mode], payload: input.payload });
  }),
  runOpenRouter: grokProcedure.input(z.object({ modality: z.enum(['image', 'video']), payload: payloadSchema })).mutation(async ({ ctx, input }) => {
    const apiKey = await getKey(ctx.serverDB, 'openrouter');
    const model = input.modality === 'video' ? 'x-ai/grok-imagine-video' : 'x-ai/grok-imagine-image-quality';
    return requestJson({ apiKey, baseUrl: OPENROUTER_API_BASE_URL, path: '/chat/completions', payload: { model, ...input.payload } });
  }),
});
