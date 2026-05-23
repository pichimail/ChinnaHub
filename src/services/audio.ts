import debug from 'debug';

import { lambdaClient } from '@/libs/trpc/client';
import { type CreateAudioServicePayload } from '@/server/routers/lambda/audio';

const log = debug('lobe-audio:service');

export class AiAudioService {
  async createAudio(payload: CreateAudioServicePayload) {
    log('Creating audio with payload: %O', payload);

    try {
      const result = await lambdaClient.audio.createAudio.mutate(payload);
      log('Audio creation service call completed: %O', {
        batchId: result.data?.batch?.id,
        generationCount: result.data?.generations?.length,
        success: result.success,
      });

      return result;
    } catch (error) {
      log('Audio creation service call failed: %O', {
        error: (error as Error).message,
        payload,
      });
      throw error;
    }
  }
}

export const audioService = new AiAudioService();
