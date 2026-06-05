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

export interface GrokImagineTaskOptions {
  callbackUrl?: string;
  generationTopicId?: string;
  mediaType?: 'image' | 'video';
  model?: string;
  provider?: string;
}

export const grokImagineService = {
  createKieTask: (
    mode: GrokImagineMode,
    input: GrokImaginePayload,
    options: GrokImagineTaskOptions = {},
  ) =>
    lambdaClient.grokImagine.createKieTask.mutate({
      callbackUrl: options.callbackUrl,
      generationTopicId: options.generationTopicId,
      input,
      mediaType: options.mediaType,
      mode,
      model: options.model,
      provider: options.provider,
    }),
  getKieTask: (taskId: string) => lambdaClient.grokImagine.getKieTask.query({ taskId }),
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
