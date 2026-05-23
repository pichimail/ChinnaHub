import debug from 'debug';

import { lambdaClient } from '@/libs/trpc/client';
import { type CreateAudioServicePayload } from '@/server/routers/lambda/audio';

const log = debug('lobe-audio:service');

export class AudioService {
  async createAudio(payload: CreateAudioServicePayload) {
    log('Creating audio with payload: %O', payload);

    try {
      const result = await lambdaClient.audio.createAudio.mutate(payload);
      log('Audio creation service call completed: %O', {
        asyncTaskId: result.data?.asyncTaskId,
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

  async getAudioStatus(asyncTaskId: string, generationId: string) {
    log('Getting audio status for asyncTaskId: %s, generationId: %s', asyncTaskId, generationId);

    try {
      const result = await lambdaClient.audio.getAudioStatus.query({
        asyncTaskId,
        generationId,
      });

      log('Audio status query completed: %O', result);

      return result;
    } catch (error) {
      log('Audio status query failed: %O', error);
      throw error;
    }
  }
}

export const audioService = new AudioService();
