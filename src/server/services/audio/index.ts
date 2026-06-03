import debug from 'debug';

import {
  type AudioModelVersion,
  type KieAudioLyrics,
  type KieAudioTrack,
  mapAudioModelVersionToKieModel,
  normalizeKieTracks,
} from './kie';

const log = debug('lobe-audio:service');

const MUSIC_API_BASE_URL = 'https://api.kie.ai/api/v1';
const KIE_POLL_MAX_RETRIES = 3;
const KIE_POLL_TIMEOUT_MS = 10_000;

export interface AudioGenerationParams {
  artist?: string;
  imageUrl?: string;
  makeInstrumental?: boolean;
  modelVersion?: AudioModelVersion;
  prompt: string;
  providerMode?: AudioProviderMode;
  style?: string;
  title?: string;
}

export type AudioProviderMode = 'classic' | 'lyria';

export interface AudioGenerationResponse {
  audioUrl?: string;
  duration?: number;
  error?: string;
  id: string;
  metadata?: Record<string, unknown>;
  status: 'processing' | 'completed' | 'failed';
  title?: string;
  tracks?: KieAudioTrack[];
}

interface KieTaskResponse {
  code?: number;
  data?: Record<string, unknown>;
  msg?: string;
}

type KieRecordInfoResponse = KieTaskResponse & {
  data?: {
    response?: { sunoData?: unknown };
    status?: string;
    errorMessage?: string;
    msg?: string;
  };
};

class KiePollError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options?: { retryable?: boolean; status?: number }) {
    super(message);
    this.name = 'KiePollError';
    this.retryable = Boolean(options?.retryable);
    this.status = options?.status;
  }
}

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status === 504 || status >= 500;

const readKieJsonResponse = async <T extends KieTaskResponse>(response: Response): Promise<T> => {
  const responseText = await response.text();

  if (!response.ok) {
    throw new KiePollError(`Poll error: ${response.status} ${response.statusText}`, {
      retryable: isRetryableStatus(response.status),
      status: response.status,
    });
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new KiePollError('KIE AI status response was not valid JSON', {
      retryable: true,
      status: response.status,
    });
  }
};

const getKieRecordInfo = async (apiKey: string, taskId: string): Promise<KieTaskResponse> => {
  const deadline = Date.now() + KIE_POLL_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < KIE_POLL_MAX_RETRIES; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), remainingMs);

    try {
      const response = await fetch(
        `${MUSIC_API_BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'GET',
          signal: controller.signal,
        },
      );

      return await readKieJsonResponse<KieTaskResponse>(response);
    } catch (error) {
      lastError = error;

      if (error instanceof KiePollError && !error.retryable) {
        throw error;
      }

      if (attempt === KIE_POLL_MAX_RETRIES - 1) break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new KiePollError(`KIE AI status polling timed out after ${KIE_POLL_TIMEOUT_MS / 1000}s`, {
    retryable: true,
    status: lastError instanceof KiePollError ? lastError.status : undefined,
  });
};

const postKieJson = async <T extends KieTaskResponse>(
  apiKey: string,
  path: string,
  payload: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(`${MUSIC_API_BASE_URL}${path}`, {
    body: JSON.stringify(payload),
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KIE AI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as T;
  if (data?.code !== 200) {
    throw new Error(data?.msg || 'KIE AI API returned non-success response');
  }

  return data;
};

const toTaskId = (data: KieTaskResponse): string => {
  return (
    (data.data?.taskId as string | undefined) ||
    (data.data?.task_id as string | undefined) ||
    (data.data?.id as string | undefined) ||
    ''
  );
};

const buildKieGeneratePayload = (
  params: AudioGenerationParams,
  options: { callBackUrl: string },
  overrides?: { model?: string },
): Record<string, unknown> => {
  const customMode = Boolean(
    params.style?.trim() || params.title?.trim() || params.makeInstrumental,
  );
  const prompt = params.prompt?.trim() || params.title?.trim() || 'instrumental music';

  const payload: Record<string, unknown> = {
    callBackUrl: options.callBackUrl,
    customMode,
    instrumental: Boolean(params.makeInstrumental),
    model: overrides?.model || mapAudioModelVersionToKieModel(params.modelVersion),
    prompt,
  };

  if (customMode) {
    payload.style =
      params.style?.trim() || (params.makeInstrumental ? 'Instrumental' : 'Vocal arrangement');
    payload.title =
      params.title?.trim() || params.prompt?.trim().slice(0, 80) || 'Generated Audio Track';
  }

  return payload;
};

export class KieAiAudioService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('KIE_AI_API_KEY environment variable is required for audio generation');
    }
    this.apiKey = apiKey;
  }

  async createMusic(
    params: AudioGenerationParams,
    options?: { callBackUrl?: string },
  ): Promise<AudioGenerationResponse> {
    log('Creating music with params: %O', params);

    try {
      if (!options?.callBackUrl) {
        throw new Error('KIE music generation callback URL is required');
      }

      const payload = buildKieGeneratePayload(params, options);

      log('Sending request to KIE AI API: %O', payload);

      let data: KieTaskResponse;
      try {
        data = await postKieJson<KieTaskResponse>(this.apiKey, '/generate', payload);
      } catch (error) {
        if (
          !params.makeInstrumental &&
          !params.style?.trim() &&
          !params.title?.trim() &&
          (error instanceof Error ? error.message.includes('KIE AI API error: 400') : false)
        ) {
          const fallbackPayload = buildKieGeneratePayload(params, options, {
            model: 'V5',
          });

          log('Retrying KIE AI API request with compatibility payload: %O', fallbackPayload);
          data = await postKieJson<KieTaskResponse>(this.apiKey, '/generate', fallbackPayload);
        } else {
          throw error;
        }
      }

      const taskId = toTaskId(data);

      log('Task created successfully: %O', {
        id: taskId || '(empty)',
      });

      return {
        id: taskId,
        status: 'processing',
      };
    } catch (error) {
      log('Music creation failed: %O', error);
      throw error;
    }
  }

  async pollMusicStatus(taskId: string): Promise<AudioGenerationResponse> {
    log('Polling music status for task: %s', taskId);

    let data: KieRecordInfoResponse;

    try {
      data = (await getKieRecordInfo(this.apiKey, taskId)) as KieRecordInfoResponse;
    } catch (error) {
      log('Poll request did not complete cleanly: %O', error);

      if (error instanceof KiePollError && !error.retryable) {
        return {
          error: error.message,
          id: taskId,
          metadata: {
            pollError: error.message,
            pollStatus: error.status,
          },
          status: 'failed',
        };
      }

      return {
        id: taskId,
        metadata: {
          pollError: error instanceof Error ? error.message : 'KIE AI status polling failed',
          pollTimedOut: true,
        },
        status: 'processing',
      };
    }

    if (data?.code && data.code !== 200) {
      throw new Error(data?.msg || `Poll error: code ${String(data?.code)}`);
    }

    const payload = data?.data || {};
    const responsePayload = payload?.response || {};
    const status = String(payload?.status || '').toUpperCase();
    const tracks = normalizeKieTracks(responsePayload?.sunoData, taskId);
    const firstTrack = tracks.find((track) => Boolean(track.audioUrl));

    log('Poll result: %O', { id: taskId, status, trackCount: tracks.length });

    if (status === 'SUCCESS' || status === 'FIRST_SUCCESS') {
      return {
        audioUrl: firstTrack?.audioUrl || '',
        duration: firstTrack?.duration,
        id: taskId,
        metadata: {
          raw: data,
          stage: status,
          trackCount: tracks.length,
        },
        status: status === 'SUCCESS' ? 'completed' : 'processing',
        title: firstTrack?.title,
        tracks,
      };
    }

    if (
      [
        'CREATE_TASK_FAILED',
        'GENERATE_AUDIO_FAILED',
        'CALLBACK_EXCEPTION',
        'SENSITIVE_WORD_ERROR',
      ].includes(status)
    ) {
      return {
        error: payload?.errorMessage || payload?.msg || 'Music generation failed',
        id: taskId,
        status: 'failed',
      };
    }

    return {
      id: taskId,
      metadata: { raw: data },
      status: 'processing',
      tracks,
    };
  }

  async getTimestampedLyrics(
    taskId: string,
    audioId: string,
  ): Promise<{
    id: string;
    lyrics?: KieAudioLyrics;
    metadata?: Record<string, unknown>;
    status: 'completed' | 'failed';
  }> {
    const data = await postKieJson<KieTaskResponse>(
      this.apiKey,
      '/generate/get-timestamped-lyrics',
      {
        audioId,
        taskId,
      },
    );

    const lyrics = data.data
      ? {
          alignedWords: Array.isArray(data.data.alignedWords)
            ? (data.data.alignedWords as KieAudioLyrics['alignedWords'])
            : undefined,
          isStreamed: data.data.isStreamed as boolean | undefined,
          raw: data.data,
          waveformData: Array.isArray(data.data.waveformData)
            ? (data.data.waveformData as number[])
            : undefined,
        }
      : undefined;

    return {
      id: audioId,
      lyrics,
      metadata: {
        raw: data,
        taskId,
      },
      status: 'completed',
    };
  }

  async generateMusicCover(
    taskId: string,
    options?: { callBackUrl?: string },
  ): Promise<AudioGenerationResponse> {
    const data = await postKieJson<KieTaskResponse>(this.apiKey, '/suno/cover/generate', {
      ...(options?.callBackUrl ? { callBackUrl: options.callBackUrl } : {}),
      taskId,
    });

    return {
      id: toTaskId(data) || taskId,
      metadata: {
        raw: data,
        taskId,
      },
      status: 'processing',
    };
  }

  async separateVocals(
    taskId: string,
    audioId: string,
    options?: {
      callBackUrl?: string;
      type?: 'separate_vocal' | 'split_stem';
    },
  ): Promise<AudioGenerationResponse> {
    const data = await postKieJson<KieTaskResponse>(this.apiKey, '/vocal-removal/generate', {
      ...(options?.callBackUrl ? { callBackUrl: options.callBackUrl } : {}),
      audioId,
      taskId,
      type: options?.type || 'separate_vocal',
    });

    return {
      id: toTaskId(data) || taskId,
      metadata: {
        raw: data,
        taskId,
      },
      status: 'processing',
    };
  }

  async createMusicVideo(
    taskId: string,
    audioId: string,
    options?: { author?: string; callBackUrl?: string; domainName?: string },
  ): Promise<AudioGenerationResponse> {
    const data = await postKieJson<KieTaskResponse>(this.apiKey, '/mp4/generate', {
      ...(options?.author ? { author: options.author } : {}),
      ...(options?.callBackUrl ? { callBackUrl: options.callBackUrl } : {}),
      ...(options?.domainName ? { domainName: options.domainName } : {}),
      audioId,
      taskId,
    });

    return {
      id: toTaskId(data) || taskId,
      metadata: {
        raw: data,
        taskId,
      },
      status: 'processing',
    };
  }
}

export class OpenRouterLyriaAudioService {
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required for Accoustica Lyria');
    }

    this.apiKey = apiKey;
    this.modelId = modelId || 'google/lyria-002';
  }

  async createMusic(params: AudioGenerationParams): Promise<AudioGenerationResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      body: JSON.stringify({
        messages: [
          {
            content: [
              params.title && `Title: ${params.title}`,
              params.style && `Style: ${params.style}`,
              params.makeInstrumental ? 'Instrumental only.' : undefined,
              params.prompt,
            ]
              .filter(Boolean)
              .join('\n'),
            role: 'user',
          },
        ],
        model: this.modelId,
      }),
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter Lyria error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as any;
    const audioUrl =
      data.audio_url ||
      data.audioUrl ||
      data.url ||
      data.choices?.[0]?.message?.audio_url ||
      data.choices?.[0]?.message?.audioUrl;

    if (!audioUrl) {
      throw new Error(
        'Accoustica Lyria did not return an audio URL. Check the configured model ID.',
      );
    }

    return {
      audioUrl,
      duration: data.duration,
      id: data.id || globalThis.crypto.randomUUID(),
      metadata: { raw: data },
      status: 'completed',
      title: params.title,
    };
  }

  async pollMusicStatus(taskId: string): Promise<AudioGenerationResponse> {
    return {
      id: taskId,
      status: 'processing',
    };
  }
}
