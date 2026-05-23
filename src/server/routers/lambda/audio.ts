import { randomBytes } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import {
  asyncTasks,
  generationBatches,
  generations,
  type NewGeneration,
  type NewGenerationBatch,
} from '@/database/schemas';
import { appEnv } from '@/envs/app';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { createAsyncCaller } from '@/server/routers/async/caller';
import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
} from '@/types/asyncTask';

const audioProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
    },
  });
});

const createAudioInputSchema = z.object({
  generationTopicId: z.string(),
  model: z.string().optional(),
  params: z
    .object({
      customMode: z.boolean().default(false),
      instrumental: z.boolean().default(false),
      negativeTags: z.string().max(300).optional(),
      prompt: z.string(),
      style: z.string().max(1000).optional(),
      title: z.string().max(80).optional(),
    })
    .passthrough(),
  provider: z.string().optional(),
});

export type CreateAudioServicePayload = z.infer<typeof createAudioInputSchema>;

const getKieApiKey = () => {
  const value = process.env.KIE_API_KEY;
  if (!value) {
    throw new Error('Missing KIE_API_KEY');
  }
  return value;
};

const getTaskId = (response: any): string | null => {
  return (
    response?.data?.taskId ??
    response?.data?.id ??
    response?.taskId ??
    response?.id ??
    response?.data?.task_id ??
    response?.task_id ??
    null
  );
};

export const audioRouter = router({
  createAudio: audioProcedure.input(createAudioInputSchema).mutation(async ({ input, ctx }) => {
    const { userId, serverDB, asyncTaskModel } = ctx;
    const { generationTopicId, params } = input;
    const provider = 'audio';
    const model = 'audio-default';
    const customMode = !!params.customMode;
    const instrumental = !!params.instrumental;
    const prompt = params.prompt?.trim() || '';
    const style = params.style?.trim() || '';
    const title = params.title?.trim() || '';
    const negativeTags = params.negativeTags?.trim() || '';

    if (!prompt) throw new Error('Prompt is required');

    if (!customMode && prompt.length > 500) {
      throw new Error('Prompt is too long for simple mode');
    }

    if (customMode) {
      if (!style) throw new Error('Style is required in advanced mode');
      if (!title) throw new Error('Title is required in advanced mode');
      if (style.length > 1000) throw new Error('Style is too long');
      if (title.length > 80) throw new Error('Title is too long');

      if (!instrumental && prompt.length > 5000) {
        throw new Error('Prompt is too long for advanced mode');
      }
    }

    const webhookToken = randomBytes(24).toString('hex');
    const configForDb = {
      customMode,
      instrumental,
      negativeTags: customMode ? negativeTags : undefined,
      prompt,
      style: customMode ? style : undefined,
      title: customMode ? title : undefined,
    };

    const {
      asyncTaskId,
      batch: createdBatch,
      generation: createdGeneration,
    } = await serverDB.transaction(async (tx) => {
      const newBatch: NewGenerationBatch = {
        config: configForDb,
        generationTopicId,
        model,
        prompt,
        provider,
        userId,
      };
      const [batch] = await tx.insert(generationBatches).values(newBatch).returning();

      const newGeneration: NewGeneration = {
        generationBatchId: batch.id,
        seed: null,
        userId,
      };
      const [generation] = await tx.insert(generations).values(newGeneration).returning();

      const [asyncTask] = await tx
        .insert(asyncTasks)
        .values({
          metadata: { webhookToken },
          status: AsyncTaskStatus.Pending,
          type: AsyncTaskType.AudioGeneration,
          userId,
        })
        .returning();

      await tx
        .update(generations)
        .set({ asyncTaskId: asyncTask.id })
        .where(and(eq(generations.id, generation.id), eq(generations.userId, userId)));

      return {
        asyncTaskId: asyncTask.id,
        batch,
        generation,
      };
    });

    try {
      const apiKey = getKieApiKey();
      const callbackBaseUrl = process.env.WEBHOOK_PROXY_URL || appEnv.APP_URL;
      const callbackUrl = `${callbackBaseUrl}/api/webhooks/audio/kie?token=${webhookToken}`;
      const submitResp = await fetch('https://api.kie.ai/api/v1/generate', {
        body: JSON.stringify({
          callBackUrl: callbackUrl,
          customMode,
          instrumental,
          model: 'V5_5',
          negativeTags: customMode && negativeTags ? negativeTags : undefined,
          prompt,
          style: customMode ? style : undefined,
          title: customMode ? title : undefined,
        }),
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const submitJson = await submitResp.json();
      const providerTaskId = getTaskId(submitJson);

      if (!submitResp.ok || !providerTaskId) {
        throw new Error(submitJson?.msg || submitJson?.message || 'Audio task submission failed');
      }

      await asyncTaskModel.update(asyncTaskId, {
        inferenceId: providerTaskId,
        status: AsyncTaskStatus.Processing,
      });

      const asyncCaller = await createAsyncCaller({ userId });
      await asyncCaller.audio.createAudio({
        asyncTaskId,
        generationId: createdGeneration.id,
        providerTaskId,
      });
    } catch (error) {
      await asyncTaskModel.update(asyncTaskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.ServerError,
          error instanceof Error ? error.message : 'Audio task submission failed',
        ),
        status: AsyncTaskStatus.Error,
      });
    }

    return {
      data: {
        batch: createdBatch,
        generations: [{ ...createdGeneration, asyncTaskId }],
      },
      success: true,
    };
  }),
});

export type AudioRouter = typeof audioRouter;
