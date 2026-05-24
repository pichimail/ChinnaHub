import debug from 'debug';

const log = debug('lobe-audio:service');

const MUSIC_API_BASE_URL = 'https://api.kie.ai/api/v1/suno';
const MUSIC_MODEL = 'music-generation-v5.5'; // V5.5 model

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

  async createMusic(params: AudioGenerationParams): Promise<AudioGenerationResponse> {
    log('Creating music with params: %O', params);

    try {
      const payload = {
        custom_mode: false,
        gpt_description_prompt: params.prompt,
        instrumental: params.makeInstrumental ?? false,
        make_instrumental: params.makeInstrumental ?? false,
        model: MUSIC_MODEL,
        mv: 'default',
        prompt: params.prompt || params.title || 'instrumental music',
        style: params.style,
        tags: params.style ? [params.style] : [],
        title: params.title || 'Generated Audio Track',
      };

      log('Sending request to KIE AI API: %O', payload);

      const response = await fetch(`${MUSIC_API_BASE_URL}/v4/music`, {
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
      const taskId = data.id || data.taskId || data.data?.id || data.data?.taskId || '';
      log('Task created successfully: %O', {
        id: taskId,
        status: data.status || data.data?.status,
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

    const response = await fetch(`${MUSIC_API_BASE_URL}/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('Poll error: %s - %s', response.status, errorText);
      throw new Error(`Poll error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    const payload = data.data || data;
    const status = payload.status || data.status;
    log('Poll result: %O', { id: taskId, status });

    if (['succeeded', 'success', 'completed', 'complete'].includes(status)) {
      return {
        audioUrl:
          payload.audio_url ||
          payload.audioUrl ||
          payload.audio ||
          payload.url ||
          payload.response?.audioUrl ||
          '',
        duration: payload.duration,
        id: taskId,
        metadata: {
          clipId: payload.clip_id,
          raw: data,
          seedId: payload.seed_id,
          title: payload.title,
        },
        status: 'completed',
        title: payload.title,
      };
    }

    if (['error', 'failed', 'failure'].includes(status)) {
      return {
        error:
          payload.error_message || payload.error || payload.message || 'Music generation failed',
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
