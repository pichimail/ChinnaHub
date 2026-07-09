import { randomBytes } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { after } from 'next/server';
import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { asyncTasks, generationBatches, generations, type NewGeneration, type NewGenerationBatch } from '@/database/schemas';
import { getServerDB } from '@/database/server';
import { appEnv } from '@/envs/app';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { GenerationService } from '@/server/services/generation';
import { VideoGenerationService } from '@/server/services/generation/video';
import { enforceUserFeatureAccess, getManagedApiKey, getManagedEnvVar } from '@/server/services/admin/runtimeGovernance';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';
import { FileSource } from '@/types/files';
import { sanitizeFileName } from '@/utils/sanitizeFileName';

const chinnaResolveTextToImageMode = (input: any = {}, meta: any = {}) => {
  const raw =
    input?.uiMode ??
    input?.mode ??
    input?.generationMode ??
    input?.config?.uiMode ??
    meta?.uiMode ??
    meta?.mode;

  const quality =
    raw === 'quality' ||
    raw === 'Quality' ||
    input?.enable_pro === true ||
    input?.enablePro === true ||
    input?.quality === true;

  return {
    uiMode: quality ? 'quality' : 'standard',
    enablePro: quality,
    expectedResultCount: quality ? 4 : 6,
  };
};

const chinnaParseKieResultUrls = (payload: any): string[] => {
  const out = new Set<string>();

  const visit = (value: any) => {
    if (!value) return;

    if (typeof value === 'string') {
      const v = value.trim();
      if (/^https?:\/\//i.test(v)) {
        out.add(v);
        return;
      }
      try {
        visit(JSON.parse(v));
      } catch {
        const matches = v.match(/https?:\/\/[^"'\s,\]]+/gi);
        if (matches) matches.forEach((url) => out.add(url));
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.resultUrls)) value.resultUrls.forEach(visit);
      if (Array.isArray(value.urls)) value.urls.forEach(visit);
      if (Array.isArray(value.images)) value.images.forEach(visit);
      if (Array.isArray(value.output)) value.output.forEach(visit);
      if (Array.isArray(value.result)) value.result.forEach(visit);

      visit(value.resultJson);
      visit(value.data);
      visit(value.response);
      visit(value.asset);
      visit(value.url);
      visit(value.imageUrl);
    }
  };

  visit(payload);
  return Array.from(out).filter(Boolean);
};



const chinnahubParseKieResultUrls = (payload: any): string[] => {
  const out = new Set<string>();

  const walk = (value: any) => {
    if (!value) return;

    if (typeof value === 'string') {
      const trimmed = value.trim();

      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          walk(JSON.parse(trimmed));
        } catch {}
      }

      for (const match of trimmed.matchAll(/https?:\/\/[^\s"'<>\\]+/g)) {
        const url = match[0].replace(/[),\]}]+$/, '');
        if (/\.(png|jpe?g|webp|mp4|webm|mp3|wav|m4a)(\?|$)/i.test(url) || /aiquickdraw|tempfile|generated|cdn|image|video|audio/i.test(url)) {
          out.add(url);
        }
      }

      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.resultUrls)) value.resultUrls.forEach((url: string) => out.add(url));
      if (Array.isArray(value.allResultUrls)) value.allResultUrls.forEach((url: string) => out.add(url));
      if (Array.isArray(value.urls)) value.urls.forEach((url: string) => out.add(url));

      if (typeof value.resultJson === 'string') {
        try {
          const parsed = JSON.parse(value.resultJson);
          if (Array.isArray(parsed.resultUrls)) parsed.resultUrls.forEach((url: string) => out.add(url));
          walk(parsed);
        } catch {}
      }

      if (value.data) walk(value.data);
      Object.values(value).forEach(walk);
    }
  };

  walk(payload);
  return [...out];
};

const chinnahubSixImageAsset = (payload: any, fallbackUrl?: string) => {
  const resultUrls = chinnahubParseKieResultUrls(payload);
  const first = resultUrls[0] || fallbackUrl;

  return {
    resultUrls,
    allResultUrls: resultUrls,
    urls: resultUrls,
    url: first,
    imageUrl: first,
    thumbnailUrl: first,
    thumbUrl: first,
    src: first,
    resultUrl: first,
    variantCount: resultUrls.length || (first ? 1 : 0),
    expectedResultCount: chinnaResolveTextToImageMode(input).expectedResultCount,
    status: first ? 'success' : 'processing',
    state: first ? 'success' : 'processing',
  };
};


const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1';
const OPENROUTER_API_BASE_URL = 'https://openrouter.ai/api/v1';

type GrokMode = 'text-to-image' | 'image-to-image' | 'image-to-video' | 'text-to-video' | 'extend' | 'upscale' | 'preview';
type MediaType = 'image' | 'video';

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
  return data as any;
};

const requestGetJson = async ({ apiKey, baseUrl, path }: { apiKey: string; baseUrl: string; path: string }) => {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}` }, method: 'GET' });
  const data = await parseJson(response);
  if (!response.ok) throw new TRPCError({ code: 'BAD_GATEWAY', message: `Provider error: ${response.status}`, cause: data });
  return data as any;
};

const getTaskId = (data: any) => data?.data?.taskId || data?.taskId || data?.data?.id || data?.id || data?.data?.recordId;
const getStatus = (data: any) => String(data?.data?.status || data?.status || '').toLowerCase();
const getResultUrl = (data: any, mediaType: MediaType) => {
  const d = data?.data || data;
  const list = d?.resultUrls || d?.urls || d?.images || d?.videos || d?.output || d?.result;
  const first = Array.isArray(list) ? list[0] : list;
  if (typeof first === 'string') return first;
  if (mediaType === 'video') return first?.videoUrl || first?.url || d?.videoUrl || d?.url;
  return chinnahubParseKieResultUrls(d)[0] || first?.imageUrl || first?.url || d?.imageUrl || d?.url;
};

const pollKieRecord = async (apiKey: string, taskId: string, mediaType: MediaType) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const data = await requestGetJson({ apiKey, baseUrl: KIE_API_BASE_URL, path: `/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}` });
    const status = getStatus(data);
    const url = getResultUrl(data, mediaType);
    if (url || ['success', 'completed', 'complete', 'succeeded'].includes(status)) return { data, url };
    if (['failed', 'fail', 'error'].includes(status)) throw new Error(data?.data?.error || data?.error || 'Kie task failed');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('Kie task timed out');
};

const persistKieResult = async ({ asyncTaskCreatedAt, asyncTaskId, generationId, mediaType, prompt, providerUrl, userId }: { asyncTaskCreatedAt: Date; asyncTaskId: string; generationId: string; mediaType: MediaType; prompt: string; providerUrl: string; userId: string }) => {
  const db = await getServerDB();
  const generationModel = new GenerationModel(db, userId);
  const asyncTaskModel = new AsyncTaskModel(db, userId);

  if (mediaType === 'image') {
    const generationService = new GenerationService(db, userId);
    const { image, thumbnailImage } = await generationService.transformImageForGeneration(providerUrl);
    const { imageUrl, thumbnailImageUrl } = await generationService.uploadImageForGeneration(image, thumbnailImage);
    await generationModel.createAssetAndFile(
      generationId,
      {
        height: image.height,
        originalUrl: providerUrl,
        thumbnailUrl: thumbnailImageUrl,
        type: 'image',
        url: imageUrl,
        width: image.width,
      },
      {
        fileHash: image.hash,
        fileType: image.mime,
        metadata: { generationId, height: image.height, path: imageUrl, width: image.width, expectedResultCount: chinnaResolveTextToImageMode(input).expectedResultCount },
        name: `${sanitizeFileName(prompt, generationId)}.${image.extension}`,
        size: image.size,
        url: imageUrl,
      },
    );
  } else {
    const videoService = new VideoGenerationService(db, userId);
    const result = await videoService.processVideoForGeneration(providerUrl);
    await generationModel.createAssetAndFile(
      generationId,
      {
        coverUrl: result.coverKey,
        duration: result.duration,
        height: result.height,
        originalUrl: providerUrl,
        thumbnailUrl: result.thumbnailKey,
        thumbUrl: result.thumbnailKey,
        imageUrl: result.url || result.imageUrl || result.thumbnailKey,
        resultUrls: chinnahubParseKieResultUrls(result),
        allResultUrls: chinnahubParseKieResultUrls(result),
        variantCount: chinnahubParseKieResultUrls(result).length || 1,
        expectedResultCount: chinnaResolveTextToImageMode(input).expectedResultCount,
        type: 'video',
        url: result.videoKey,
        width: result.width,
      },
      {
        fileHash: result.fileHash,
        fileType: result.mimeType,
        name: `${sanitizeFileName(prompt, generationId)}.mp4`,
        size: result.fileSize,
        url: result.videoKey,
      },
      FileSource.VideoGeneration,
    );
  }

  await asyncTaskModel.update(asyncTaskId, {
    duration: Date.now() - asyncTaskCreatedAt.getTime(),
    status: AsyncTaskStatus.Success,
  });
};

const persistKieFailure = async (asyncTaskId: string, userId: string, error: unknown) => {
  const db = await getServerDB();
  const asyncTaskModel = new AsyncTaskModel(db, userId);
  await asyncTaskModel.update(asyncTaskId, {
    error: new AsyncTaskError(AsyncTaskErrorType.ServerError, error instanceof Error ? error.message : 'Kie task failed'),
    status: AsyncTaskStatus.Error,
  });
};

export const grokImagineRouter = router({
  createKieTask: grokProcedure
    .input(
      z.object({
        callbackUrl: z.string().url().optional(),
        generationTopicId: z.string().optional(),
        input: inputSchema,
        mediaType: z.enum(['image', 'video']).optional(),
        mode: z.enum(['text-to-image', 'image-to-image', 'image-to-video', 'text-to-video', 'extend', 'upscale', 'preview']),
        model: z.string().optional(),
        provider: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = await getKey(ctx.serverDB, 'kie');
      const mediaType: MediaType = input.mediaType || (input.mode.includes('video') || input.mode === 'extend' ? 'video' : 'image');
      const callbackBaseUrl = process.env.WEBHOOK_PROXY_URL || appEnv.APP_URL;
      const callbackUrl = input.callbackUrl || `${callbackBaseUrl}/api/webhooks/grok-imagine/${mediaType}`;
      const prompt = input.input.prompt || input.mode;

      if (!input.generationTopicId) {
        return requestJson({
          apiKey,
          baseUrl: KIE_API_BASE_URL,
          path: '/jobs/createTask',
          payload: { callBackUrl: callbackUrl, input: input.input, model: modelByMode[input.mode] },
        });
      }

      const webhookToken = randomBytes(32).toString('hex');
      const taskType = mediaType === 'image' ? AsyncTaskType.ImageGeneration : AsyncTaskType.VideoGeneration;

      const { asyncTaskCreatedAt, asyncTaskId, batch, generation } = await ctx.serverDB.transaction(async (tx) => {
        const newBatch: NewGenerationBatch = {
          config: input.input,
          generationTopicId: input.generationTopicId!,
          model: input.model || modelByMode[input.mode],
          prompt,
          provider: input.provider || (mediaType === 'image' ? 'chinnaimage' : 'chinnavideo'),
          userId: ctx.userId,
        };
        const [createdBatch] = await tx.insert(generationBatches).values(newBatch).returning();
        const newGeneration: NewGeneration = { generationBatchId: createdBatch.id, seed: null, userId: ctx.userId };
        const [createdGeneration] = await tx.insert(generations).values(newGeneration).returning();
        const [createdTask] = await tx
          .insert(asyncTasks)
          .values({ metadata: { webhookToken }, status: AsyncTaskStatus.Pending, type: taskType, userId: ctx.userId })
          .returning();
        await tx.update(generations).set({ asyncTaskId: createdTask.id }).where(and(eq(generations.id, createdGeneration.id), eq(generations.userId, ctx.userId)));
        return { asyncTaskCreatedAt: createdTask.createdAt, asyncTaskId: createdTask.id, batch: createdBatch, generation: createdGeneration };
      });

      const created = await requestJson({
        apiKey,
        baseUrl: KIE_API_BASE_URL,
        path: '/jobs/createTask',
        payload: { callBackUrl: `${callbackUrl}?token=${webhookToken}`, input: input.input, model: modelByMode[input.mode] },
      });
      const kieTaskId = getTaskId(created);
      const asyncTaskModel = new AsyncTaskModel(ctx.serverDB, ctx.userId);
      await asyncTaskModel.update(asyncTaskId, { inferenceId: kieTaskId, status: AsyncTaskStatus.Processing });

      after(async () => {
        try {
          const { url } = await pollKieRecord(apiKey, kieTaskId, mediaType);
          if (!url) throw new Error('Kie completed without a media URL');
          await persistKieResult({ asyncTaskCreatedAt, asyncTaskId, generationId: generation.id, mediaType, prompt, providerUrl: url, userId: ctx.userId });
        } catch (error) {
          await persistKieFailure(asyncTaskId, ctx.userId, error);
        }
      });

      return { data: { batch, generations: [{ ...generation, asyncTaskId }], providerTaskId: kieTaskId }, success: true };
    }),

  getKieTask: grokProcedure.input(z.object({ taskId: z.string() })).query(async ({ ctx, input }) => {
    const apiKey = await getKey(ctx.serverDB, 'kie');
    return requestGetJson({ apiKey, baseUrl: KIE_API_BASE_URL, path: `/jobs/recordInfo?taskId=${encodeURIComponent(input.taskId)}` });
  }),

  runOpenRouter: grokProcedure.input(z.object({ modality: z.enum(['image', 'video']), payload: z.record(z.string(), z.any()).default({}) })).mutation(async ({ ctx, input }) => {
    const apiKey = await getKey(ctx.serverDB, 'openrouter');
    const model = input.modality === 'video' ? 'x-ai/grok-imagine-video' : 'x-ai/grok-imagine-image-quality';
    return requestJson({ apiKey, baseUrl: OPENROUTER_API_BASE_URL, path: '/chat/completions', payload: { model, ...input.payload } });
  }),
});
