import debug from 'debug';

const log = debug('lobe-audio:service');

const MUSIC_API_BASE_URL = 'https://api.kie.ai/api/v1';
const MUSIC_MODEL = 'V5_5';

export interface AudioGenerationParams {
  makeInstrumental?: boolean;
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
  metadata?: Record<string, any>;
  status: 'processing' | 'completed' | 'failed';
  title?: string;
}

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
      const customMode = Boolean(params.style?.trim() || params.title?.trim());

      const payload = {
        ...(options?.callBackUrl ? { callBackUrl: options.callBackUrl } : {}),
        customMode,
        instrumental: params.makeInstrumental ?? false,
        model: MUSIC_MODEL,
        prompt: params.prompt || params.title || 'instrumental music',
        ...(customMode
          ? {
              style: params.style?.trim() || 'Instrumental',
              title: params.title?.trim() || 'Generated Audio Track',
            }
          : {}),
      };

      log('Sending request to KIE AI API: %O', payload);

      const response = await fetch(`${MUSIC_API_BASE_URL}/generate`, {
        body: JSON.stringify(payload),
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const errorText = await response.text();
        log('KIE AI API error: %s %s - %s', response.status, response.statusText, errorText);
        throw new Error(`KIE AI API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      if (data?.code !== 200) {
        throw new Error(data?.msg || 'KIE AI API returned non-success response');
      }

      const taskId =
        data?.data?.taskId || data?.data?.task_id || data?.taskId || data?.task_id || '';
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

    const response = await fetch(
      `${MUSIC_API_BASE_URL}/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      log('Poll error: %s - %s', response.status, errorText);
      throw new Error(`Poll error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    if (data?.code && data.code !== 200) {
      throw new Error(data?.msg || `Poll error: code ${String(data?.code)}`);
    }

    const payload = data?.data || {};
    const responsePayload = payload?.response || {};
    const status = String(payload?.status || '').toUpperCase();
    const sunoData = Array.isArray(responsePayload?.sunoData) ? responsePayload.sunoData : [];
    const firstTrack = sunoData.find(
      (item: any) =>
        item?.audioUrl ||
        item?.audio_url ||
        item?.streamAudioUrl ||
        item?.stream_audio_url ||
        item?.url,
    );

    log('Poll result: %O', { id: taskId, status, trackCount: sunoData.length });

    if (status === 'SUCCESS' || status === 'FIRST_SUCCESS') {
      return {
        audioUrl:
          firstTrack?.audioUrl ||
          firstTrack?.audio_url ||
          firstTrack?.streamAudioUrl ||
          firstTrack?.stream_audio_url ||
          firstTrack?.url ||
          '',
        duration: firstTrack?.duration,
        id: taskId,
        metadata: {
          clipId: firstTrack?.id,
          raw: data,
          title: firstTrack?.title,
        },
        status: 'completed',
        title: firstTrack?.title,
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
      id: data.id || crypto.randomUUID(),
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
