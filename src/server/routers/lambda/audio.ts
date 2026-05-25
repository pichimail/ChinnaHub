import { randomUUID } from 'node:crypto';

import { AsyncTaskStatus, AsyncTaskType, FileSource } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { GenerationModel } from '@/database/models/generation';
import { GenerationBatchModel } from '@/database/models/generationBatch';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import {
  enforceContentTextPolicy,
  enforceGovernancePolicy,
  enforceProviderAvailability,
  enforceUserFeatureAccess,
  getManagedApiKey,
  getManagedEnvVar,
  writeGovernanceEnforcementAudit,
} from '@/server/services/admin/runtimeGovernance';
import {
  type AudioGenerationParams,
  type AudioGenerationResponse,
  type AudioProviderMode,
  KieAiAudioService,
  OpenRouterLyriaAudioService,
} from '@/server/services/audio';
import { FileService } from '@/server/services/file';

const CLASSIC_PROVIDER = 'kie-ai';
const CLASSIC_MODEL = 'music-generation-v5.5';
const LYRIA_PROVIDER = 'openrouter';
const DEFAULT_LYRIA_MODEL = 'google/lyria-002';

type AudioTaskMetadata = {
  audioUrl?: string;
  duration?: number;
  fileId?: string;
  model: string;
  originalUrl?: string;
  parameters: AudioGenerationParams;
  provider: string;
  providerMode: AudioProviderMode;
  taskId: string;
};

const audioProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      fileService: new FileService(ctx.serverDB, ctx.userId),
      generationBatchModel: new GenerationBatchModel(ctx.serverDB, ctx.userId),
      generationModel: new GenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

export type CreateAudioServicePayload = {
  parameters: AudioGenerationParams;
  topicId: string;
};

const createAudioService = async (
  db: any,
  providerMode: AudioProviderMode,
): Promise<{
  model: string;
  provider: string;
  service: Pick<KieAiAudioService, 'createMusic' | 'pollMusicStatus'>;
}> => {
  if (providerMode === 'lyria') {
    const [managedKey, managedAudioEnvKey, managedAiEnvKey, managedModel] = await Promise.all([
      getManagedApiKey(db, 'openrouter_audio_generation'),
      getManagedEnvVar(db, 'OPENROUTER_API_KEY', 'audio'),
      getManagedEnvVar(db, 'OPENROUTER_API_KEY', 'ai'),
      getManagedEnvVar(db, 'OPENROUTER_LYRIA_MODEL', 'audio'),
    ]);
    const apiKey =
      managedKey || managedAudioEnvKey || managedAiEnvKey || process.env.OPENROUTER_API_KEY;
    const model = managedModel || process.env.OPENROUTER_LYRIA_MODEL || DEFAULT_LYRIA_MODEL;

    if (!apiKey) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Accoustica Lyria API key is not configured in admin or environment',
      });
    }

    return {
      model,
      provider: LYRIA_PROVIDER,
      service: new OpenRouterLyriaAudioService(apiKey, model),
    };
  }

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

  return {
    model: CLASSIC_MODEL,
    provider: CLASSIC_PROVIDER,
    service: new KieAiAudioService(apiKey),
  };
};

const persistCompletedAudio = async ({
  ctx,
  generationId,
  metadata,
  response,
}: {
  ctx: any;
  generationId: string;
  metadata: AudioTaskMetadata;
  response: AudioGenerationResponse;
}) => {
  if (!response.audioUrl) return metadata;

  const extension = response.audioUrl.split('?')[0].split('.').pop() || 'mp3';
  const safeExtension = extension.length > 8 ? 'mp3' : extension;
  const pathname = `generations/audio/${ctx.userId}/${randomUUID()}.${safeExtension}`;
  const file = await ctx.fileService.uploadFromUrl(
    response.audioUrl,
    pathname,
    FileSource.AudioGeneration,
  );

  await ctx.generationModel.update(generationId, {
    asset: {
      duration: response.duration,
      fileId: file.fileId,
      originalUrl: response.audioUrl,
      type: 'audio',
      url: file.key,
    },
    fileId: file.fileId,
  });

  return {
    ...metadata,
    audioUrl: file.key,
    duration: response.duration,
    fileId: file.fileId,
    originalUrl: response.audioUrl,
  };
};

export const audioRouter = router({
  createAudio: audioProcedure
    .input(
      z.object({
        parameters: z.object({
          makeInstrumental: z.boolean().optional(),
          prompt: z.string().min(1, 'Prompt is required'),
          providerMode: z.enum(['classic', 'lyria']).optional(),
          style: z.string().optional(),
          title: z.string().optional(),
        }),
        topicId: z.string().min(1, 'Topic ID is required'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const providerMode = input.parameters.providerMode || 'classic';
        const featureKey =
          providerMode === 'lyria' ? 'audio_accoustica_lyria' : 'audio_accoustica_classic';

        const [audioAccess, modeAccess] = await Promise.all([
          enforceUserFeatureAccess(ctx.serverDB, {
            flagKey: 'ai_audio',
            label: 'Audio generation',
            userId: ctx.userId,
          }),
          enforceUserFeatureAccess(ctx.serverDB, {
            flagKey: featureKey,
            label: providerMode === 'lyria' ? 'Accoustica Lyria' : 'Accoustica Classic',
            userId: ctx.userId,
          }),
        ]);

        const deniedAccess = [audioAccess, modeAccess].find((access) => !access.allowed);
        if (deniedAccess) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: deniedAccess.reason || 'Audio generation is not available for your plan',
          });
        }

        const target =
          providerMode === 'lyria'
            ? 'provider:openrouter:model:lyria'
            : 'provider:kie-ai:model:music-generation-v5.5';

        const audioPolicy = await enforceGovernancePolicy(ctx.serverDB, {
          domain: 'audio',
          target,
          userId: ctx.userId,
        });

        if (!audioPolicy.allowed) {
          await writeGovernanceEnforcementAudit(ctx.serverDB, {
            action:
              audioPolicy.mode === 'throttle'
                ? 'governance.policy_throttle'
                : 'governance.policy_block',
            metadata: {
              domain: 'audio',
              mode: audioPolicy.mode,
              policyId: audioPolicy.policyId,
              requestTarget: target,
              resolvedTarget: audioPolicy.target,
            },
            reason: audioPolicy.reason,
            targetId: audioPolicy.policyId,
            userId: ctx.userId,
          });
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: audioPolicy.reason || 'Audio generation blocked by governance policy',
          });
        }

        const pricingPolicy = await enforceGovernancePolicy(ctx.serverDB, {
          domain: 'pricing',
          target: 'feature:ai_audio',
          userId: ctx.userId,
        });

        if (!pricingPolicy.allowed) {
          await writeGovernanceEnforcementAudit(ctx.serverDB, {
            action:
              pricingPolicy.mode === 'throttle'
                ? 'governance.policy_throttle'
                : 'governance.policy_block',
            metadata: {
              domain: 'pricing',
              mode: pricingPolicy.mode,
              policyId: pricingPolicy.policyId,
              requestTarget: 'feature:ai_audio',
              resolvedTarget: pricingPolicy.target,
            },
            reason: pricingPolicy.reason,
            targetId: pricingPolicy.policyId,
            userId: ctx.userId,
          });
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: pricingPolicy.reason || 'Audio generation is not available for current policy',
          });
        }

        const contentPolicy = await enforceContentTextPolicy(ctx.serverDB, {
          contextTarget: 'audio:prompt',
          domain: 'audio',
          text: [
            input.parameters.title || '',
            input.parameters.style || '',
            input.parameters.prompt || '',
          ].join('\n'),
          userId: ctx.userId,
        });

        if (!contentPolicy.allowed) {
          await writeGovernanceEnforcementAudit(ctx.serverDB, {
            action: 'governance.content_block',
            metadata: {
              domain: 'content',
              policyId: contentPolicy.policyId,
              requestTarget: 'audio:prompt',
              resolvedTarget: contentPolicy.target,
            },
            reason: contentPolicy.reason,
            targetId: contentPolicy.policyId,
            userId: ctx.userId,
          });
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: contentPolicy.reason || 'Audio content blocked by policy',
          });
        }

        const { model, provider, service } = await createAudioService(ctx.serverDB, providerMode);
        const providerPolicy = await enforceProviderAvailability(ctx.serverDB, {
          model,
          provider,
          userId: ctx.userId,
        });

        if (!providerPolicy.allowed) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: providerPolicy.reason || 'AI provider is disabled by admin policy',
          });
        }

        const musicResponse = await service.createMusic(input.parameters);

        if (!musicResponse.id) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create music generation task',
          });
        }

        const asyncTaskId = await ctx.asyncTaskModel.create({
          metadata: {
            model,
            parameters: input.parameters,
            provider,
            providerMode,
            taskId: musicResponse.id,
          } satisfies AudioTaskMetadata,
          status:
            musicResponse.status === 'completed'
              ? AsyncTaskStatus.Success
              : AsyncTaskStatus.Processing,
          type: AsyncTaskType.AudioGeneration,
        });

        const batch = await ctx.generationBatchModel.create({
          config: input.parameters,
          generationTopicId: input.topicId,
          model,
          prompt: input.parameters.prompt,
          provider,
        });

        const generation = await ctx.generationModel.create({
          asyncTaskId,
          generationBatchId: batch.id,
          seed: null,
        });

        if (musicResponse.status === 'completed' && musicResponse.audioUrl) {
          const metadata = await persistCompletedAudio({
            ctx,
            generationId: generation.id,
            metadata: {
              model,
              parameters: input.parameters,
              provider,
              providerMode,
              taskId: musicResponse.id,
            },
            response: musicResponse,
          });
          await ctx.asyncTaskModel.update(asyncTaskId, {
            metadata,
            status: AsyncTaskStatus.Success,
          });
        }

        const transformed = await ctx.generationModel.findByIdAndTransform(generation.id);

        return {
          data: {
            asyncTaskId,
            batch: {
              config: input.parameters,
              createdAt: batch.createdAt,
              generations: transformed ? [transformed] : [],
              id: batch.id,
              model: batch.model,
              prompt: batch.prompt,
              provider: batch.provider,
            },
            generations: transformed ? [transformed] : [],
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

        if (asyncTask.status === AsyncTaskStatus.Processing) {
          const metadata = asyncTask.metadata as AudioTaskMetadata | undefined;
          const taskId = metadata?.taskId;

          if (taskId && metadata.providerMode) {
            const { service } = await createAudioService(ctx.serverDB, metadata.providerMode);
            const audioResponse = await service.pollMusicStatus(taskId);

            if (audioResponse.status === 'completed') {
              const nextMetadata = await persistCompletedAudio({
                ctx,
                generationId: input.generationId,
                metadata,
                response: audioResponse,
              });

              await ctx.asyncTaskModel.update(input.asyncTaskId, {
                metadata: nextMetadata,
                status: AsyncTaskStatus.Success,
              });
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

        const [latestTask, generation] = await Promise.all([
          ctx.asyncTaskModel.findById(input.asyncTaskId),
          ctx.generationModel.findByIdAndTransform(input.generationId),
        ]);

        return {
          error: latestTask?.error || null,
          generation: generation || null,
          status: latestTask?.status || asyncTask.status,
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
