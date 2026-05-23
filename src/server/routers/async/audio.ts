import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { asyncAuthedProcedure, asyncRouter as router } from '@/libs/trpc/async';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@/types/asyncTask';

const audioProcedure = asyncAuthedProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      generationModel: new GenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

const createAudioInputSchema = z.object({
  asyncTaskId: z.string(),
  generationId: z.string(),
  providerTaskId: z.string(),
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readTaskState = async (providerTaskId: string) => {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('Missing KIE_API_KEY');

  const res = await fetch(
    `https://api.kie.ai/api/v1/generate/record-info?taskId=${providerTaskId}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    },
  );

  const data = await res.json();

  const payload = data?.data ?? data;
  const statusRaw = payload?.status ?? payload?.state ?? payload?.taskStatus ?? '';
  const status = String(statusRaw).toLowerCase();
  const variants = Array.isArray(payload?.response?.sunoData)
    ? payload.response.sunoData
    : Array.isArray(payload?.sunoData)
      ? payload.sunoData
      : [];
  const variant = variants[0] || payload?.response || payload;

  const audioUrl =
    variant?.streamAudioUrl ??
    variant?.audioUrl ??
    variant?.songUrl ??
    variant?.url ??
    payload?.audioUrl ??
    null;

  return { audioUrl, payload, res, status };
};

export const audioRouter = router({
  createAudio: audioProcedure.input(createAudioInputSchema).mutation(async ({ input, ctx }) => {
    const { asyncTaskId, generationId, providerTaskId } = input;

    const maxAttempts = 120;
    const intervalMs = 3000;

    try {
      let lastUrl: string | null = null;

      for (let i = 0; i < maxAttempts; i++) {
        const { audioUrl, payload, res, status } = await readTaskState(providerTaskId);

        if (audioUrl && audioUrl !== lastUrl) {
          lastUrl = audioUrl;
          await ctx.generationModel.update(generationId, {
            asset: {
              mimeType: 'audio/mpeg',
              originalUrl: audioUrl,
              thumbnailUrl: audioUrl,
              type: 'audio',
              url: audioUrl,
            } as any,
          });
        }

        if (!res.ok) {
          throw new Error(payload?.msg || payload?.message || 'Audio status request failed');
        }

        const isTerminalSuccess =
          status === 'success' ||
          status === 'complete' ||
          status === 'finished' ||
          status === 'all_success';
        const isIntermediateSuccess =
          status === 'text_success' || status === 'first_success' || status === 'processing';

        if (isTerminalSuccess) {
          await ctx.asyncTaskModel.update(asyncTaskId, { status: AsyncTaskStatus.Success });
          return { success: true };
        }

        if (status.includes('fail') || status.includes('error')) {
          throw new Error(payload?.msg || payload?.message || 'Audio generation failed');
        }

        if (isIntermediateSuccess) {
          await sleep(intervalMs);
          continue;
        }

        await sleep(intervalMs);
      }

      throw new Error('Audio generation timeout');
    } catch (error) {
      await ctx.asyncTaskModel.update(asyncTaskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.ServerError,
          error instanceof Error ? error.message : 'Audio generation failed',
        ),
        status: AsyncTaskStatus.Error,
      });

      return { success: false };
    }
  }),
});
