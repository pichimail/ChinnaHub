import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  enforceGovernancePolicy,
  getManagedApiKey,
  getManagedEnvVar,
} from '@/server/services/admin/runtimeGovernance';
import { type AudioGenerationParams, KieAiAudioService } from '@/server/services/audio';
import { AsyncTaskStatus } from '@/types/asyncTask';

const audioProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      generationModel: new GenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

export type CreateAudioServicePayload = {
  parameters: AudioGenerationParams;
  topicId: string;
};

export const audioRouter = router({
  createAudio: audioProcedure
    .input(
      z.object({
        parameters: z.object({
          makeInstrumental: z.boolean().optional(),
          prompt: z.string().min(1, 'Prompt is required'),
          style: z.string().optional(),
          title: z.string().optional(),
        }),
        topicId: z.string().min(1, 'Topic ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const audioPolicy = await enforceGovernancePolicy(ctx.serverDB, {
          domain: 'audio',
          target: 'provider:kie-ai:model:music-generation-v5.5',
          userId: ctx.userId,
        });

        if (!audioPolicy.allowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: audioPolicy.reason || 'Audio generation blocked by governance policy',
          });
        }

        const adminManagedKey = await getManagedApiKey(ctx.serverDB, 'audio_generation');
        const adminManagedEnvKey = await getManagedEnvVar(ctx.serverDB, 'KIE_AI_API_KEY', 'audio');
        const apiKey = adminManagedKey || adminManagedEnvKey || process.env.KIE_AI_API_KEY;

        if (!apiKey) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Audio provider API key is not configured in admin or environment',
          });
        }

        const audioService = new KieAiAudioService(apiKey);

        // Create music generation task via KIE AI API
        const musicResponse = await audioService.createMusic(input.parameters);

        if (!musicResponse.id) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create music generation task',
          });
        }

        // Create async task record
        const asyncTask = await ctx.asyncTaskModel.create({
          metadata: {
            parameters: input.parameters,
            taskId: musicResponse.id,
          },
          status: AsyncTaskStatus.Processing,
        });

        // Create generation batch and record
        const batch = await ctx.generationModel.createBatch(input.topicId);

        const generation = await ctx.generationModel.create({
          asyncTaskId: asyncTask.id,
          batchId: batch.id,
          model: 'music-generation-v5.5', // V5.5 model
          params: input.parameters,
          topicId: input.topicId,
        });

        return {
          data: {
            asyncTaskId: asyncTask.id,
            batch,
            generations: [generation],
          },
          success: true,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[audioRouter.createAudio] Error:', error);

        return {
          error: {
            code: 'CREATION_FAILED',
            message: errorMessage,
          },
          success: false,
        };
      }
    }),

  getAudioStatus: audioProcedure
    .input(
      z.object({
        asyncTaskId: z.string(),
        generationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const asyncTask = await ctx.asyncTaskModel.findById(input.asyncTaskId);

        if (!asyncTask) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Async task not found',
          });
        }

        // If still processing, poll for updates
        if (asyncTask.status === AsyncTaskStatus.Processing) {
          const metadata = asyncTask.metadata as any;
          const taskId = metadata?.taskId;

          if (taskId) {
            const audioService = getAudioService();
            const audioResponse = await audioService.pollMusicStatus(taskId);

            // Update task status based on response
            if (audioResponse.status === 'completed') {
              await ctx.asyncTaskModel.update(input.asyncTaskId, {
                metadata: {
                  ...metadata,
                  audioUrl: audioResponse.audioUrl,
                  duration: audioResponse.duration,
                },
                status: AsyncTaskStatus.Success,
              });

              // Update generation with audio URL
              const generation = await ctx.generationModel.findByIdAndTransform(input.generationId);
              if (generation) {
                await ctx.generationModel.update(input.generationId, {
                  asset: {
                    ...generation.asset,
                    audioUrl: audioResponse.audioUrl,
                    duration: audioResponse.duration,
                  },
                });
              }
            } else if (audioResponse.status === 'failed') {
              await ctx.asyncTaskModel.update(input.asyncTaskId, {
                error: {
                  code: 'GENERATION_FAILED',
                  message: audioResponse.error || 'Music generation failed',
                },
                status: AsyncTaskStatus.Error,
              });
            }
          }
        }

        const generation = await ctx.generationModel.findByIdAndTransform(input.generationId);

        return {
          error: asyncTask.error || null,
          generation: generation || null,
          status: asyncTask.status,
        };
      } catch (error) {
        console.error('[audioRouter.getAudioStatus] Error:', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get audio status',
        });
      }
    }),
});
