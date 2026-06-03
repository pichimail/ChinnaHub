import { randomBytes } from 'node:crypto';

import { AsyncTaskStatus, AsyncTaskType } from '@lobechat/types';
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
  type AudioGenerationAsset,
  type AudioGenerationParams,
  type AudioModelVersion,
  type AudioProviderMode,
  KieAiAudioService,
  OpenRouterLyriaAudioService,
} from '@/server/services/audio';
import {
  type KieAudioTrack,
  mapAudioModelVersionToKieModel,
  persistKieTrack,
} from '@/server/services/audio/kie';
import { FileService } from '@/server/services/file';

const CLASSIC_PROVIDER = 'kie-ai';
const DEFAULT_CLASSIC_MODEL_VERSION: AudioModelVersion = 'V3.0';
const LYRIA_PROVIDER = 'openrouter';
const DEFAULT_LYRIA_MODEL = 'google/lyria-002';

type AudioTaskMetadata = {
  audioUrl?: string;
  artist?: string;
  duration?: number;
  fileId?: string;
  model: string;
  modelVersion?: AudioModelVersion;
  originalUrl?: string;
  generationIds?: string[];
  followUpTaskIds?: string[];
  followUpTaskMap?: Record<string, string>;
  parameters: AudioGenerationParams;
  provider: string;
  providerMode: AudioProviderMode;
  tracks?: KieAudioTrack[];
  taskId: string;
  webhookToken?: string;
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
  modelVersion?: AudioModelVersion,
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

  const model = mapAudioModelVersionToKieModel(modelVersion || DEFAULT_CLASSIC_MODEL_VERSION);
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
    model,
    provider: CLASSIC_PROVIDER,
    service: new KieAiAudioService(apiKey),
  };
};

const buildKieCallbackUrl = (webhookToken?: string): string | undefined => {
  const callbackBaseUrl = process.env.WEBHOOK_PROXY_URL || process.env.APP_URL;

  if (!callbackBaseUrl || !webhookToken) return undefined;

  return `${callbackBaseUrl.replace(/\/+$/, '')}/api/webhooks/audio/kie?token=${webhookToken}`;
};

const appendFollowUpTaskId = async (
  asyncTaskModel: AsyncTaskModel,
  asyncTaskId: string,
  taskId: string,
  generationId: string,
): Promise<void> => {
  if (!asyncTaskId) return;

  const asyncTask = await asyncTaskModel.findById(asyncTaskId);
  if (!asyncTask) return;

  const metadata = (asyncTask.metadata || {}) as AudioTaskMetadata;
  const followUpTaskIds = Array.from(
    new Set([...(metadata.followUpTaskIds || []), taskId].filter(Boolean)),
  );
  const followUpTaskMap = {
    ...metadata.followUpTaskMap,
    [taskId]: generationId,
  };

  await asyncTaskModel.update(asyncTaskId, {
    metadata: {
      ...metadata,
      followUpTaskIds,
      followUpTaskMap,
    } satisfies AudioTaskMetadata,
  });
};

const persistCompletedAudioTrack = async ({
  ctx,
  generationId,
  metadata,
  track,
}: {
  ctx: any;
  generationId: string;
  metadata: AudioTaskMetadata;
  track: KieAudioTrack;
}) => {
  return await persistKieTrack({
    fileService: ctx.fileService,
    generationId,
    generationModel: ctx.generationModel,
    metadata,
    track,
    userId: ctx.userId,
  });
};

const getTrackContext = async (ctx: any, generationId: string) => {
  const generation = await ctx.generationModel.findByIdWithAsyncTask(generationId);
  if (!generation) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Generation not found',
    });
  }

  const metadata = generation.asyncTask?.metadata as AudioTaskMetadata | undefined;
  if (!metadata?.taskId || !metadata.providerMode) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Audio generation metadata is missing',
    });
  }

  const asset = (generation.asset || {}) as AudioGenerationAsset;
  const audioId = asset.audioId || metadata.generationIds?.[0];

  if (!audioId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Audio track identifier is missing',
    });
  }

  return {
    asset,
    audioId,
    asyncTaskId: generation.asyncTaskId || '',
    metadata,
  };
};

export const audioRouter = router({
  createAudio: audioProcedure
    .input(
      z.object({
        parameters: z.object({
          artist: z.string().optional(),
          imageUrl: z.string().optional(),
          makeInstrumental: z.boolean().optional(),
          prompt: z.string().min(1, 'Prompt is required'),
          modelVersion: z.enum(['V1.0', 'V2.0', 'V3.0']).optional(),
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
        const modelVersion = input.parameters.modelVersion || DEFAULT_CLASSIC_MODEL_VERSION;
        const classicModel = mapAudioModelVersionToKieModel(modelVersion);
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
            label: providerMode === 'lyria' ? 'Accoustica Lyria' : 'Accoustica Kie/Suno',
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
            : `provider:kie-ai:model:${classicModel}`;

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

        const { model, provider, service } = await createAudioService(
          ctx.serverDB,
          providerMode,
          modelVersion,
        );
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

        const webhookToken =
          providerMode === 'classic' ? randomBytes(32).toString('hex') : undefined;
        const callbackUrl = buildKieCallbackUrl(webhookToken);

        const musicResponse = await service.createMusic(input.parameters, {
          callBackUrl: callbackUrl,
        });

        if (!musicResponse.id) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create music generation task',
          });
        }

        const asyncTaskId = await ctx.asyncTaskModel.create({
          metadata: {
            artist: input.parameters.artist,
            generationIds: [],
            followUpTaskIds: [],
            followUpTaskMap: {},
            model,
            modelVersion,
            parameters: input.parameters,
            provider,
            providerMode,
            taskId: musicResponse.id,
            webhookToken,
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

        const generationCount = providerMode === 'classic' ? 2 : 1;
        const generations = await Promise.all(
          Array.from({ length: generationCount }, async () =>
            ctx.generationModel.create({
              asyncTaskId,
              generationBatchId: batch.id,
              seed: null,
            }),
          ),
        );

        await ctx.asyncTaskModel.update(asyncTaskId, {
          metadata: {
            artist: input.parameters.artist,
            generationIds: generations.map((generation) => generation.id),
            followUpTaskIds: [],
            followUpTaskMap: {},
            model,
            modelVersion,
            parameters: input.parameters,
            provider,
            providerMode,
            taskId: musicResponse.id,
            webhookToken,
          } satisfies AudioTaskMetadata,
        });

        if (
          providerMode === 'lyria' &&
          musicResponse.status === 'completed' &&
          musicResponse.audioUrl &&
          generations[0]
        ) {
          const synthesizedTrack: KieAudioTrack = {
            artist: input.parameters.artist || 'ChinnaHub',
            audioId: generations[0].id,
            audioUrl: musicResponse.audioUrl,
            duration: musicResponse.duration,
            parentTaskId: musicResponse.id,
            taskId: musicResponse.id,
            title: input.parameters.title || input.parameters.prompt,
          };

          const persistedMetadata = await persistCompletedAudioTrack({
            ctx,
            generationId: generations[0].id,
            metadata: {
              artist: input.parameters.artist,
              generationIds: generations.map((generation) => generation.id),
              followUpTaskIds: [],
              followUpTaskMap: {},
              model,
              modelVersion,
              parameters: input.parameters,
              provider,
              providerMode,
              taskId: musicResponse.id,
              webhookToken,
            },
            track: synthesizedTrack,
          });

          await ctx.asyncTaskModel.update(asyncTaskId, {
            metadata: persistedMetadata satisfies AudioTaskMetadata,
            status: AsyncTaskStatus.Success,
          });
        }

        const transformedGenerations = await Promise.all(
          generations.map((generation) => ctx.generationModel.findByIdAndTransform(generation.id)),
        );

        return {
          data: {
            asyncTaskId,
            batch: {
              config: input.parameters,
              createdAt: batch.createdAt,
              generations: transformedGenerations.filter(Boolean),
              id: batch.id,
              model: batch.model,
              prompt: batch.prompt,
              provider: batch.provider,
            },
            generations: transformedGenerations.filter(Boolean),
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

        const metadata = asyncTask.metadata as AudioTaskMetadata | undefined;

        if (asyncTask.status === AsyncTaskStatus.Processing) {
          const taskId = metadata?.taskId;

          if (taskId && metadata?.providerMode) {
            const { service } = await createAudioService(
              ctx.serverDB,
              metadata.providerMode,
              metadata.modelVersion,
            );
            const audioResponse = await service.pollMusicStatus(taskId).catch((error) => {
              console.error('[audioRouter.getAudioStatus] Poll provider error:', error);

              return {
                id: taskId,
                metadata: {
                  pollError:
                    error instanceof Error ? error.message : 'Audio provider polling failed',
                },
                status: 'processing' as const,
              };
            });
            const generationIds = metadata.generationIds || [];
            const audioTracks = audioResponse.tracks?.length
              ? audioResponse.tracks
              : audioResponse.audioUrl
                ? [
                    {
                      audioId: generationIds[0],
                      audioUrl: audioResponse.audioUrl,
                      duration: audioResponse.duration,
                      parentTaskId: taskId,
                      taskId,
                      title: audioResponse.title,
                    } as KieAudioTrack,
                  ]
                : [];

            if (audioTracks.length > 0 && generationIds.length > 0) {
              const nextMetadata = { ...metadata, tracks: audioTracks };
              const trackPairs = generationIds.map((generationId, index) => ({
                generationId,
                track: audioTracks[index],
              }));

              let persistedMetadata = nextMetadata;
              for (const { generationId, track } of trackPairs) {
                if (!track?.audioUrl) continue;

                persistedMetadata = await persistCompletedAudioTrack({
                  ctx,
                  generationId,
                  metadata: persistedMetadata,
                  track,
                });
              }

              const allTracksReady =
                audioResponse.status === 'completed' &&
                generationIds.every((generationId, index) =>
                  Boolean(trackPairs[index]?.track?.audioUrl),
                );

              await ctx.asyncTaskModel.update(input.asyncTaskId, {
                metadata: persistedMetadata,
                status: allTracksReady ? AsyncTaskStatus.Success : AsyncTaskStatus.Processing,
              });
            } else if (audioResponse.status === 'failed') {
              await ctx.asyncTaskModel.update(input.asyncTaskId, {
                error: {
                  code: 'GENERATION_FAILED',
                  message: audioResponse.error || 'Music generation failed',
                },
                metadata: {
                  ...metadata,
                  tracks: audioResponse.tracks || [],
                },
                status: AsyncTaskStatus.Error,
              });
            }
          }
        }

        const latestTask = await ctx.asyncTaskModel.findById(input.asyncTaskId);
        const generationIds = metadata?.generationIds || [];
        const generations = generationIds.length
          ? await Promise.all(
              generationIds.map((generationId) =>
                ctx.generationModel.findByIdAndTransform(generationId),
              ),
            )
          : [];

        return {
          error: latestTask?.error || null,
          generations: generations.filter(Boolean),
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

  getTimestampedLyrics: audioProcedure
    .input(
      z.object({
        generationId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { asset, audioId, metadata } = await getTrackContext(ctx, input.generationId);

      if (metadata.providerMode !== 'classic') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Timestamped lyrics are only available for Kie/Suno tracks',
        });
      }

      const { service } = await createAudioService(
        ctx.serverDB,
        metadata.providerMode,
        metadata.modelVersion,
      );
      const lyricsResponse = await (service as KieAiAudioService).getTimestampedLyrics(
        metadata.taskId,
        audioId,
      );

      const nextAsset = {
        ...asset,
        lyrics: lyricsResponse.lyrics,
        lyricsTaskId: metadata.taskId,
      };

      await ctx.generationModel.update(input.generationId, {
        asset: nextAsset,
      });

      return {
        generation: await ctx.generationModel.findByIdAndTransform(input.generationId),
        lyrics: lyricsResponse.lyrics,
      };
    }),

  generateMusicCover: audioProcedure
    .input(
      z.object({
        generationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { asset, asyncTaskId, metadata } = await getTrackContext(ctx, input.generationId);

      if (metadata.providerMode !== 'classic') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Music covers are only available for Kie/Suno tracks',
        });
      }

      const { service } = await createAudioService(
        ctx.serverDB,
        metadata.providerMode,
        metadata.modelVersion,
      );
      const response = await (service as KieAiAudioService).generateMusicCover(metadata.taskId, {
        callBackUrl: buildKieCallbackUrl(metadata.webhookToken),
      });

      await ctx.generationModel.update(input.generationId, {
        asset: {
          ...asset,
          coverTaskId: response.id,
        },
      });

      await appendFollowUpTaskId(ctx.asyncTaskModel, asyncTaskId, response.id, input.generationId);

      return {
        generation: await ctx.generationModel.findByIdAndTransform(input.generationId),
        taskId: response.id,
      };
    }),

  separateVocals: audioProcedure
    .input(
      z.object({
        generationId: z.string(),
        type: z.enum(['separate_vocal', 'split_stem']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { asset, asyncTaskId, audioId, metadata } = await getTrackContext(
        ctx,
        input.generationId,
      );

      if (metadata.providerMode !== 'classic') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Stem separation is only available for Kie/Suno tracks',
        });
      }

      const { service } = await createAudioService(
        ctx.serverDB,
        metadata.providerMode,
        metadata.modelVersion,
      );
      const response = await (service as KieAiAudioService).separateVocals(
        metadata.taskId,
        audioId,
        {
          callBackUrl: buildKieCallbackUrl(metadata.webhookToken),
          type: input.type,
        },
      );

      await ctx.generationModel.update(input.generationId, {
        asset: {
          ...asset,
          vocalsTaskId: response.id,
        },
      });

      await appendFollowUpTaskId(ctx.asyncTaskModel, asyncTaskId, response.id, input.generationId);

      return {
        generation: await ctx.generationModel.findByIdAndTransform(input.generationId),
        taskId: response.id,
      };
    }),

  createMusicVideo: audioProcedure
    .input(
      z.object({
        author: z.string().optional(),
        domainName: z.string().optional(),
        generationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { asset, asyncTaskId, audioId, metadata } = await getTrackContext(
        ctx,
        input.generationId,
      );

      if (metadata.providerMode !== 'classic') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Music videos are only available for Kie/Suno tracks',
        });
      }

      const { service } = await createAudioService(
        ctx.serverDB,
        metadata.providerMode,
        metadata.modelVersion,
      );
      const response = await (service as KieAiAudioService).createMusicVideo(
        metadata.taskId,
        audioId,
        {
          author: input.author || 'ChinnaHub',
          callBackUrl: buildKieCallbackUrl(metadata.webhookToken),
          domainName: input.domainName,
        },
      );

      await ctx.generationModel.update(input.generationId, {
        asset: {
          ...asset,
          videoTaskId: response.id,
        },
      });

      await appendFollowUpTaskId(ctx.asyncTaskModel, asyncTaskId, response.id, input.generationId);

      return {
        generation: await ctx.generationModel.findByIdAndTransform(input.generationId),
        taskId: response.id,
      };
    }),
});
