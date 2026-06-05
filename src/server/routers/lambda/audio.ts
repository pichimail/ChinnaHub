import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { sunoClient } from '@/business/server/audio-generation/suno';
import { AudioGenerationModel } from '@/database/models/audioGeneration';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const CHINNA_AUDIO_PROVIDER = 'chinnahub';
const CHINNA_AUDIO_MODEL = 'chinnaaudio';

const audioProcedure = authedProcedure.use(serverDatabase).use(async (opts) => {
  const { ctx } = opts;
  return opts.next({
    ctx: {
      audioGenerationModel: new AudioGenerationModel(ctx.serverDB, ctx.userId),
    },
  });
});

const generateAudioInput = z
  .object({
    prompt: z.string().min(1).max(5000),
    /** Custom mode: user provides their own lyrics + style */
    customMode: z.boolean().default(false),
    /** Music style tags (custom mode, e.g. "pop rock energetic") */
    style: z.string().max(1000).optional(),
    /** Song title (custom mode only) */
    title: z.string().max(100).optional(),
    /** Generate instrumental (no vocals) */
    makeInstrumental: z.boolean().default(false),
    /** Strict Accoustica model registry guard */
    model: z.enum([CHINNA_AUDIO_MODEL, 'accoustica']).default(CHINNA_AUDIO_MODEL),
    provider: z.enum([CHINNA_AUDIO_PROVIDER]).default(CHINNA_AUDIO_PROVIDER),
    /** Optional callback URL for async completion */
    callbackUrl: z.string().url().optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.customMode && input.prompt.length > 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 500,
        inclusive: true,
        type: 'string',
        path: ['prompt'],
        message: 'Simple Accoustica prompt must be 500 characters or less',
      });
    }
  });

const getAudioStatusInput = z.object({
  taskId: z.string().min(1),
});

const getAudioDetailsInput = z.object({
  audioId: z.string().uuid(),
});

const deleteAudioInput = z.object({
  audioId: z.string().uuid(),
});

const listAudioHistoryInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const audioRouter = router({
  /**
   * Generate music from a text description or custom lyrics.
   * Strictly uses the ChinnaHub Accoustica registry model.
   */
  generateAudio: audioProcedure
    .input(generateAudioInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const taskId = await sunoClient.generateMusic({
          prompt: input.prompt,
          customMode: input.customMode,
          style: input.style,
          title: input.title,
          make_instrumental: input.makeInstrumental,
          callBackUrl: input.callbackUrl,
        });

        const audioGeneration = await ctx.audioGenerationModel.create({
          prompt: input.prompt,
          musicStyle: input.style || 'auto',
          duration: 0,
          modelVersion: input.model,
          taskId,
          status: 'pending',
        });

        return {
          audioId: audioGeneration.id,
          taskId,
          status: 'pending' as const,
          createdAt: audioGeneration.createdAt,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate audio',
        });
      }
    }),

  /**
   * Poll the current status of an audio generation task
   */
  getAudioStatus: audioProcedure
    .input(getAudioStatusInput)
    .query(async ({ ctx, input }) => {
      const audioRecord = await ctx.audioGenerationModel.findByTaskId(input.taskId);

      if (!audioRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Audio task not found' });
      }

      if (audioRecord.status === 'completed' || audioRecord.status === 'failed') {
        return {
          taskId: input.taskId,
          audioId: audioRecord.id,
          status: audioRecord.status,
          audioUrl: audioRecord.audioUrl,
          progress: audioRecord.status === 'completed' ? 100 : 0,
          metadata: audioRecord.audioMetadata,
          clips: (audioRecord.audioMetadata as any)?.clips ?? [],
          error: audioRecord.error,
          createdAt: audioRecord.createdAt,
        };
      }

      const task = await sunoClient.getTaskStatus(input.taskId);

      const firstClip = task.clips?.find((c) => c.audio_url || c.stream_audio_url);
      const audioUrl = firstClip?.audio_url || firstClip?.stream_audio_url || task.audio_url;

      if (task.status !== audioRecord.status || (audioUrl && !audioRecord.audioUrl)) {
        await ctx.audioGenerationModel.update(audioRecord.id, {
          status: task.status,
          audioUrl: audioUrl ?? undefined,
          audioMetadata: {
            title: task.title || firstClip?.title,
            duration: task.duration || firstClip?.duration,
            imageLargeUrl: task.image_large_url || firstClip?.image_large_url,
            imageUrl: task.image_url || firstClip?.image_url,
            ...(task.clips ? { clips: task.clips } : {}),
          } as any,
          error: task.error,
        });
      }

      const progress =
        task.status === 'completed'
          ? 100
          : task.status === 'processing'
            ? 55
            : task.status === 'pending'
              ? 20
              : 0;

      return {
        taskId: input.taskId,
        audioId: audioRecord.id,
        status: task.status,
        audioUrl: audioUrl ?? null,
        progress,
        metadata: {
          title: task.title || firstClip?.title,
          duration: task.duration || firstClip?.duration,
          imageLargeUrl: task.image_large_url || firstClip?.image_large_url,
          imageUrl: task.image_url || firstClip?.image_url,
        },
        clips: task.clips ?? [],
        error: task.error,
        createdAt: audioRecord.createdAt,
      };
    }),

  /**
   * Get full details of an audio generation record
   */
  getAudioDetails: audioProcedure
    .input(getAudioDetailsInput)
    .query(async ({ ctx, input }) => {
      const audioRecord = await ctx.audioGenerationModel.findById(input.audioId);

      if (!audioRecord) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Audio generation not found' });
      }

      return {
        id: audioRecord.id,
        taskId: audioRecord.taskId,
        prompt: audioRecord.prompt,
        musicStyle: audioRecord.musicStyle,
        duration: audioRecord.duration,
        modelVersion: audioRecord.modelVersion,
        status: audioRecord.status,
        audioUrl: audioRecord.audioUrl,
        metadata: audioRecord.audioMetadata,
        createdAt: audioRecord.createdAt,
        updatedAt: audioRecord.updatedAt,
      };
    }),

  /** Delete an audio generation record */
  deleteAudio: audioProcedure.input(deleteAudioInput).mutation(async ({ ctx, input }) => {
    const audioRecord = await ctx.audioGenerationModel.findById(input.audioId);
    if (!audioRecord) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Audio generation not found' });
    }
    await ctx.audioGenerationModel.delete(input.audioId);
    return { success: true };
  }),

  /** Paginated list of user's audio generation history */
  listAudioHistory: audioProcedure.input(listAudioHistoryInput).query(async ({ ctx, input }) => {
    const offset = (input.page - 1) * input.pageSize;
    const { data, total } = await ctx.audioGenerationModel.listByUser(input.pageSize, offset);

    return {
      items: data.map((audio) => ({
        id: audio.id,
        taskId: audio.taskId,
        prompt: audio.prompt,
        musicStyle: audio.musicStyle,
        duration: audio.duration,
        status: audio.status,
        audioUrl: audio.audioUrl,
        metadata: audio.audioMetadata,
        createdAt: audio.createdAt,
        updatedAt: audio.updatedAt,
      })),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }),
});

export type AudioRouter = typeof audioRouter;
