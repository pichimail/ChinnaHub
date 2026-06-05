export const CHINNA_IMAGE_PROVIDER = 'chinnaimage';
export const CHINNA_VIDEO_PROVIDER = 'chinnavideo';

export const CHINNA_IMAGE_MODELS = new Set([
  'grok-imagine/text-to-image',
  'grok-imagine/image-to-image',
  'grok-imagine/upscale',
  'x-ai/grok-imagine-image-quality',
]);

export const CHINNA_VIDEO_MODELS = new Set([
  'grok-imagine/text-to-video',
  'grok-imagine/image-to-video',
  'grok-imagine/extend',
  'grok-imagine/upscale',
  'grok-imagine/1-5-preview',
  'grok-imagine-video-1-5-preview',
  'x-ai/grok-imagine-video',
]);

export const isChinnaImageModel = (provider?: string, model?: string) =>
  provider === CHINNA_IMAGE_PROVIDER || (!!model && CHINNA_IMAGE_MODELS.has(model));

export const isChinnaVideoModel = (provider?: string, model?: string) =>
  provider === CHINNA_VIDEO_PROVIDER || (!!model && CHINNA_VIDEO_MODELS.has(model));

export const resolveChinnaImageMode = (model: string, params: Record<string, unknown>) => {
  if (model === 'x-ai/grok-imagine-image-quality') return 'auto-image';
  if (model === 'grok-imagine/image-to-image' || Array.isArray(params.imageUrls) || params.imageUrl) {
    return 'image-to-image';
  }
  if (model === 'grok-imagine/upscale') return 'upscale';
  return 'text-to-image';
};

export const resolveChinnaVideoMode = (model: string, params: Record<string, unknown>) => {
  if (model === 'x-ai/grok-imagine-video') return 'auto-video';
  if (model === 'grok-imagine/1-5-preview' || model === 'grok-imagine-video-1-5-preview') return 'preview';
  if (model === 'grok-imagine/extend' || params.task_id || params.extend_at || params.extend_times) return 'extend';
  if (model === 'grok-imagine/upscale') return 'upscale';
  if (model === 'grok-imagine/image-to-video' || params.imageUrl || params.image_urls) return 'image-to-video';
  return 'text-to-video';
};

export const toKieInput = (params: Record<string, any>) => ({
  aspect_ratio: params.aspect_ratio || params.aspectRatio,
  duration: params.duration,
  extend_at: params.extend_at,
  extend_times: params.extend_times,
  image_urls: params.image_urls || params.imageUrls || (params.imageUrl ? [params.imageUrl] : undefined),
  mode: params.mode,
  prompt: params.prompt,
  resolution: params.resolution,
  task_id: params.task_id || params.taskId,
});
