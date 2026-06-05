import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { enforceUserFeatureAccess, getManagedApiKey, getManagedEnvVar } from '@/server/services/admin/runtimeGovernance';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';

type GrokMode =
  | 'text-to-image'
  | 'image-to-image'
  | 'image-to-video'
  | 'text-to-video'
  | 'extend'
  | 'upscale'
  | 'preview';

const modelByMode: Record<GrokMode, string> = {
  extend: 'grok-imagine/extend',
  'image-to-image': 'grok-imagine/image-to-image',
  'image-to-video': 'grok-imagine/image-to-video',
  preview: 'grok-imagine-video-1-5-preview',
  'text-to-image': 'grok-imagine/text-to-image',
  'text-to-video': 'grok-imagine/text-to-video',
  upscale: 'grok-imagine/upscale',
};

const inputSchema = z
  .object({
    aspect_ratio: z.string().optional(),
    duration: z.union([z.string(), z.number()]).optional(),
    extend_at: z.union([z.string(), z.number()]).optional(),
    extend_times: z.union([z.string(), z.number()]).optional(),
    image_urls: z.array(z.string()).optional(),
    mode: z.enum(['fun', 'normal', 'spicy']).optional(),
    prompt: z.string().optional(),
    resolution: z.string().optional(),
    task_id: z.string().optional(),
  })
  .passthrough();

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

const parseJson = async (response: Response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const requestJson = async ({ apiKey, baseUrl, path, payload }: { apiKey: string; baseUrl: string; path: string; payload: Record<string, unknown> }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const data = await parseJson(response);
  if (!response.ok) throw new TRPCError({ code: 'BAD_GATEWAY', message: `Provider error: ${response.status}`, cause: data });
  return data;
};

const requestGetJson = async ({ apiKey, baseUrl, path }: { apiKey: string; baseUrl: string; path: string }) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    method: 'GET',
  });
  const data = await parseJson(response);
  if (!response.ok) throw new TRPCError({ code: 'BAD_GATEWAY', message: `Provider error: ${response.status}`, cause: data });
  return data;
};

export const grokImagineRouter = router({
  createKieTask: grokProcedure
    .input(
      z.object({
        callbackUrl: z.string().url().optional(),
        input: inputSchema,
        mode: z.enum(['text-to-image', 'image-to-image', 'image-to-video', 'text-to-video', 'extend', 'upscale', 'preview']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getKey(ctx.serverDB, 'kie');
      return requestJson({
        apiKey,
        baseUrl: KIE_API_BASE_URL,
        path: '/jobs/createTask',
        payload: {
          callBackUrl: input.callbackUrl,
          input: input.input,
          model: modelByMode[input.mode],
        },
      });
    }),

  getKieTask: grokProcedure.input(z.object({ taskId: z.string() })).query(async ({ ctx, input }) => {
    const apiKey = await getKey(ctx.serverDB, 'kie');
    return requestGetJson({
      apiKey,
      baseUrl: KIE_API_BASE_URL,
      path: `/jobs/recordInfo?taskId=${encodeURIComponent(input.taskId)}`,
    });
  }),

  runOpenRouter: grokProcedure.input(z.object({ modality: z.enum(['image', 'video']), payload: z.record(z.string(), z.any()).default({}) })).mutation(async ({ ctx, input }) => {
    const apiKey = await getKey(ctx.serverDB, 'openrouter');
    const model = input.modality === 'video' ? 'x-ai/grok-imagine-video' : 'x-ai/grok-imagine-image-quality';
    return requestJson({ apiKey, baseUrl: OPENROUTER_API_BASE_URL, path: '/chat/completions', payload: { model, ...input.payload } });
  }),
});
