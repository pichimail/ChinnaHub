import type { UIChatMessage } from '@lobechat/types';

import { chatService } from '@/services/chat';

export type PromptAssistantIntent = 'enhance' | 'generate';
export type PromptAssistantMode = 'audio' | 'image' | 'video';

const PROMPT_ASSISTANT_MODEL = 'openrouter/auto';
const PROMPT_ASSISTANT_PROVIDER = 'openrouter';

const createMessage = (
  role: UIChatMessage['role'],
  content: string,
  imageUrls?: string[],
): UIChatMessage => {
  const now = Date.now();

  return {
    content,
    createdAt: now,
    id: `prompt-assistant-${role}-${now}-${Math.random().toString(36).slice(2, 10)}`,
    imageList:
      role === 'user' && imageUrls?.length
        ? imageUrls.map((url, index) => ({
            alt: `reference-${index + 1}`,
            id: `prompt-assistant-image-${index + 1}`,
            url,
          }))
        : undefined,
    role,
    updatedAt: now,
  };
};

const buildSystemPrompt = ({
  hasImages,
  intent,
  mode,
}: {
  hasImages: boolean;
  intent: PromptAssistantIntent;
  mode: PromptAssistantMode;
}) => {
  const actionLine =
    intent === 'generate'
      ? 'Generate a fresh production-ready prompt.'
      : 'Enhance the user prompt into a stronger production-ready prompt.';

  const imageLine = hasImages
    ? 'Use the attached image references as hard grounding for subject, emotion, atmosphere, styling, and scene details.'
    : 'When no images are attached, infer a compelling but practical concept without overcomplicating it.';

  switch (mode) {
    case 'audio': {
      return `You are an expert music prompt engineer for AI song generation.

${actionLine}
${imageLine}

For audio prompts:
- Translate visual cues into musical direction: mood, tempo, genre, instrumentation, vocal presence, production style, and emotional arc.
- If the scene suggests vocals, write for a complete vocal song; if it clearly suggests instrumental scoring, make that explicit.
- Keep the prompt concise, vivid, and directly usable for music generation.
- Preserve the user's language.
- Output ONLY the final prompt text.`;
    }
    case 'video': {
      return `You are an expert video prompt engineer.

${actionLine}
${imageLine}

For video prompts:
- Include subject, action, camera framing, motion, timing, lighting, and atmosphere when useful.
- Keep motion coherent and easy to generate.
- Preserve the user's language.
- Output ONLY the final prompt text.`;
    }
    case 'image':
    default: {
      return `You are an expert image prompt engineer.

${actionLine}
${imageLine}

For image prompts:
- Include subject, scene, style, composition, lighting, and mood when useful.
- Keep the prompt concise, concrete, and easy to generate.
- Preserve the user's language.
- Output ONLY the final prompt text.`;
    }
  }
};

const buildUserPrompt = ({
  hasImages,
  intent,
  mode,
  prompt,
}: {
  hasImages: boolean;
  intent: PromptAssistantIntent;
  mode: PromptAssistantMode;
  prompt?: string | null;
}) => {
  if (intent === 'enhance') return prompt?.trim() || '';

  if (hasImages) {
    switch (mode) {
      case 'audio': {
        return 'Create a song-generation prompt based on the attached image references.';
      }
      case 'video': {
        return 'Create a video-generation prompt based on the attached image references.';
      }
      case 'image':
      default: {
        return 'Create an image-generation prompt based on the attached image references.';
      }
    }
  }

  switch (mode) {
    case 'audio': {
      return 'Generate a fresh, original music-generation prompt with a clear mood, style, and sonic direction.';
    }
    case 'video': {
      return 'Generate a fresh, original video-generation prompt with a clear subject, action, and camera plan.';
    }
    case 'image':
    default: {
      return 'Generate a fresh, original image-generation prompt with a clear subject, style, and atmosphere.';
    }
  }
};

export const generatePromptWithAssistant = async ({
  imageUrls = [],
  intent,
  mode,
  onLoadingChange,
  prompt,
}: {
  imageUrls?: string[];
  intent: PromptAssistantIntent;
  mode: PromptAssistantMode;
  onLoadingChange?: (loading: boolean) => void;
  prompt?: string | null;
}): Promise<string> => {
  let output = '';
  let taskError: Error | undefined;
  const normalizedImageUrls = imageUrls.filter(Boolean);
  const hasImages = normalizedImageUrls.length > 0;

  await chatService.fetchPresetTaskResult({
    onError: (error) => {
      taskError = error;
    },
    onFinish: async (text) => {
      output = text.trim() || output.trim();
    },
    onLoadingChange,
    onMessageHandle: (chunk) => {
      if (chunk.type === 'text') output += chunk.text;
    },
    params: {
      messages: [
        createMessage('system', buildSystemPrompt({ hasImages, intent, mode })),
        createMessage(
          'user',
          buildUserPrompt({ hasImages, intent, mode, prompt }),
          normalizedImageUrls,
        ),
      ],
      model: PROMPT_ASSISTANT_MODEL,
      provider: PROMPT_ASSISTANT_PROVIDER,
    },
  });

  if (taskError) throw taskError;

  const finalPrompt = output.trim();
  if (!finalPrompt) throw new Error('Prompt assistant returned an empty result');

  return finalPrompt;
};
