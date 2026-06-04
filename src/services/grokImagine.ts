import { lambdaClient } from '@/libs/trpc/client';

export type GrokImagineMode =
  | 'text-to-image'
  | 'image-to-image'
  | 'image-to-video'
  | 'text-to-video'
  | 'extend'
  | 'upscale'
  | 'preview';

export type GrokImaginePayload = Record<string, unknown>;

export const grokImagineService = {
  runChinnaImage: (mode: Extract<GrokImagineMode, 'text-to-image' | 'image-to-image' | 'upscale'>, payload: GrokImaginePayload) =>
    lambdaClient.grokImagine.runKie.mutate({ mode, payload }),
  runChinnaVideo: (mode: Extract<GrokImagineMode, 'image-to-video' | 'text-to-video' | 'extend' | 'preview'>, payload: GrokImaginePayload) =>
    lambdaClient.grokImagine.runKie.mutate({ mode, payload }),
  runChinnaAutoImage: (payload: GrokImaginePayload) =>
    lambdaClient.grokImagine.runOpenRouter.mutate({ modality: 'image', payload }),
  runChinnaAutoVideo: (payload: GrokImaginePayload) =>
    lambdaClient.grokImagine.runOpenRouter.mutate({ modality: 'video', payload }),
};

export const brandedGrokModels = {
  chinnaAutoImage: 'chinnaauto/image',
  chinnaAutoVideo: 'chinnaauto/video',
  chinnaImage: 'chinnaimage-v1.0',
  chinnaVideo: 'chinnavideo-v1.0',
  chinnaVideoPreview: 'chinnavideo-v2.0',
};
