import debug from 'debug';

const log = debug('lobe-audio:service');

const MUSIC_API_BASE_URL = 'https://api.kie.ai/api/v1/suno';
const MUSIC_MODEL = 'music-generation-v5.5'; // V5.5 model
const POLLING_INTERVAL = 3000; // 3 seconds (configurable: 3-5 seconds)
const MAX_POLLING_ATTEMPTS = 200; // ~10 minutes max

export interface AudioGenerationParams {
  makeInstrumental?: boolean;
  prompt: string;
  style?: string;
  title?: string;
}

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
      log('Task created successfully: %O', { id: data.id, status: data.status });

      return {
        id: data.id || '',
        status: 'processing',
      };
    } catch (error) {
      log('Music creation failed: %O', error);
      throw error;
    }
  }

  async pollMusicStatus(taskId: string): Promise<AudioGenerationResponse> {
    log('Polling music status for task: %s', taskId);

    let attempts = 0;

    while (attempts < MAX_POLLING_ATTEMPTS) {
      try {
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
        log('Poll result: %O', { status: data.status, id: taskId });

        // Task completed successfully
        if (data.status === 'succeeded' || data.status === 'success') {
          return {
            audioUrl: data.audio_url || data.audioUrl || '',
            duration: data.duration,
            id: taskId,
            metadata: {
              clipId: data.clip_id,
              seedId: data.seed_id,
              title: data.title,
            },
            status: 'completed',
            title: data.title,
          };
        }

        // Task failed
        if (data.status === 'error' || data.status === 'failed') {
          return {
            error: data.error_message || 'Music generation failed',
            id: taskId,
            status: 'failed',
          };
        }

        // Still processing - wait and retry
        if (data.status === 'processing' || data.status === 'pending' || data.status === 'queued') {
          attempts++;
          log('Task still processing (attempt %d/%d), waiting...', attempts, MAX_POLLING_ATTEMPTS);
          await this.delay(POLLING_INTERVAL);
          continue;
        }

        // Unknown status
        log('Unknown status: %s', data.status);
        return {
          id: taskId,
          status: 'processing',
        };
      } catch (error) {
        log('Poll failed: %O', error);
        attempts++;

        if (attempts >= MAX_POLLING_ATTEMPTS) {
          throw new Error('Music generation polling timeout', { cause: error });
        }

        await this.delay(POLLING_INTERVAL);
      }
    }

    throw new Error('Music generation polling timeout');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let audioServiceInstance: KieAiAudioService | null = null;

export const getAudioService = (): KieAiAudioService => {
  if (!audioServiceInstance) {
    const apiKey = process.env.KIE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('KIE_AI_API_KEY environment variable is not set');
    }
    audioServiceInstance = new KieAiAudioService(apiKey);
  }
  return audioServiceInstance;
};
