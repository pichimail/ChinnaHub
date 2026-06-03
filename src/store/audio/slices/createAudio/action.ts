import { AsyncTaskStatus } from '@lobechat/types';
import { t } from 'i18next';

import { message } from '@/components/AntdStaticMethods';
import { audioService } from '@/services/audio';
import { type StoreSetter } from '@/store/types';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { type AudioStore } from '../../store';
import { audioGenerationConfigSelectors } from '../generationConfig/selectors';
import { audioGenerationTopicSelectors } from '../generationTopic/selectors';

type Setter = StoreSetter<AudioStore>;

export const createCreateAudioSlice = (set: Setter, get: () => AudioStore, _api?: unknown) =>
  new CreateAudioActionImpl(set, get, _api);

export class CreateAudioActionImpl {
  readonly #get: () => AudioStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => AudioStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  createAudio = async (): Promise<void> => {
    this.#set({ isCreating: true }, false, 'createAudio/startCreateAudio');

    const store = this.#get();
    const parameters = audioGenerationConfigSelectors.parameters(store);
    const activeGenerationTopicId = audioGenerationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;
    const username = userProfileSelectors.username(useUserStore.getState());
    const defaultArtist =
      parameters.artist?.trim() || (username && username !== 'anonymous' ? username : undefined);

    if (!parameters.prompt) {
      message.warning(t('generation.validation.promptRequired', { ns: 'audio' }));
      this.#set({ isCreating: false }, false, 'createAudio/endCreateAudio');
      return;
    }

    let finalTopicId = activeGenerationTopicId;
    let isNewTopic = false;

    if (!activeGenerationTopicId) {
      isNewTopic = true;
      const prompts = [parameters.prompt];
      const newGenerationTopicId = await createGenerationTopic(prompts);
      finalTopicId = newGenerationTopicId;

      setTopicBatchLoaded(newGenerationTopicId);
      switchGenerationTopic(newGenerationTopicId);
    }

    try {
      if (isNewTopic) {
        this.#set(
          { isCreatingWithNewTopic: true },
          false,
          'createAudio/startCreateAudioWithNewTopic',
        );
      }

      const result = await audioService.createAudio({
        parameters: {
          artist: defaultArtist,
          makeInstrumental: parameters.makeInstrumental,
          modelVersion: parameters.modelVersion,
          prompt: parameters.prompt,
          providerMode: parameters.providerMode,
          style: parameters.style,
          title: parameters.title,
        },
        topicId: finalTopicId!,
      });

      if (result.success) {
        if (result.data?.batch && finalTopicId) {
          store.internal_dispatchGenerationBatch(
            finalTopicId,
            result.data.batch,
            'createAudio/dispatchCreatedBatch',
          );

          const generation = result.data.generations?.[0];
          if (generation?.task?.status === AsyncTaskStatus.Processing) {
            void this.pollAudioStatus({
              asyncTaskId: result.data.asyncTaskId,
              batchId: result.data.batch.id,
              topicId: finalTopicId,
            });
          }
        }

        message.success(t('generation.success', { ns: 'audio' }));
      } else {
        message.error(result.error?.message || t('generation.failed', { ns: 'audio' }));
      }
    } catch (error) {
      console.error('[CreateAudio] Error:', error);
      message.error(t('generation.failed', { ns: 'audio' }));
    } finally {
      this.#set(
        { isCreating: false, isCreatingWithNewTopic: false },
        false,
        'createAudio/endCreateAudio',
      );
    }
  };

  pollAudioStatus = async ({
    asyncTaskId,
    batchId,
    topicId,
  }: {
    asyncTaskId: string;
    batchId: string;
    topicId: string;
  }): Promise<void> => {
    const maxAttempts = 120;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const status = await audioService.getAudioStatus(asyncTaskId);
      if (status.generations?.length) {
        const batches = this.#get().generationBatchesMap[topicId] || [];
        const batch = batches.find((item) => item.id === batchId);

        if (batch) {
          this.#get().internal_dispatchGenerationBatch(
            topicId,
            {
              ...batch,
              generations: batch.generations.map(
                (generation) =>
                  status.generations!.find(
                    (updatedGeneration) => updatedGeneration.id === generation.id,
                  ) || generation,
              ),
            },
            'createAudio/updatePolledGeneration',
          );
        }
      }

      if (status.status === AsyncTaskStatus.Success || status.status === AsyncTaskStatus.Error) {
        return;
      }
    }
  };
}

export type CreateAudioAction = ReturnType<typeof createCreateAudioSlice>;
