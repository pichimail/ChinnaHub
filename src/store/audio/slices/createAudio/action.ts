import { AsyncTaskStatus } from '@lobechat/types';
import { t } from 'i18next';

import { message } from '@/components/AntdStaticMethods';
import { audioService } from '@/services/audio';
import { generatePromptWithAssistant } from '@/services/promptAssistant';
import { type StoreSetter } from '@/store/types';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { type AudioStore } from '../../store';
import { audioGenerationConfigSelectors } from '../generationConfig/selectors';
import { audioGenerationTopicSelectors } from '../generationTopic/selectors';

type Setter = StoreSetter<AudioStore>;
const AUDIO_POLL_INTERVAL_MS = 2000;
const AUDIO_POLL_MAX_ATTEMPTS = 300;
const AUDIO_POLL_MAX_FAILURES = 3;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const countPlayableGenerations = (generations: { asset?: any }[] = []) =>
  generations.filter((generation) =>
    Boolean(generation.asset?.url || generation.asset?.originalUrl),
  ).length;

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
    let finalPrompt = parameters.prompt?.trim() || '';

    if (!finalPrompt && parameters.imageUrl) {
      try {
        finalPrompt = await generatePromptWithAssistant({
          imageUrls: [parameters.imageUrl],
          intent: 'generate',
          mode: 'audio',
        });

        store.setAudioPrompt(finalPrompt);
      } catch (error) {
        console.error('[CreateAudio] Failed to generate prompt from image:', error);
        message.error(t('generation.failed', { ns: 'audio' }));
        this.#set({ isCreating: false }, false, 'createAudio/endCreateAudio');
        return;
      }
    }

    if (!finalPrompt) {
      message.warning(t('generation.validation.promptOrImageRequired', { ns: 'audio' }));
      this.#set({ isCreating: false }, false, 'createAudio/endCreateAudio');
      return;
    }

    let finalTopicId = activeGenerationTopicId;
    let isNewTopic = false;

    if (!activeGenerationTopicId) {
      isNewTopic = true;
      const prompts = [finalPrompt];
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
          imageUrl: parameters.imageUrl,
          makeInstrumental: parameters.makeInstrumental,
          modelVersion: parameters.modelVersion,
          prompt: finalPrompt,
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
    let consecutiveFailures = 0;
    let lastPlayableCount = countPlayableGenerations(
      this.#get().generationBatchesMap[topicId]?.find((batch) => batch.id === batchId)?.generations,
    );

    for (let attempt = 0; attempt < AUDIO_POLL_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await wait(AUDIO_POLL_INTERVAL_MS);

      try {
        const status = await audioService.getAudioStatus(asyncTaskId);
        consecutiveFailures = 0;

        if (status.generations?.length) {
          const batches = this.#get().generationBatchesMap[topicId] || [];
          const batch = batches.find((item) => item.id === batchId);

          if (batch) {
            const nextGenerations = batch.generations.map(
              (generation) =>
                status.generations!.find(
                  (updatedGeneration) => updatedGeneration.id === generation.id,
                ) || generation,
            );
            const nextPlayableCount = countPlayableGenerations(nextGenerations);

            this.#get().internal_dispatchGenerationBatch(
              topicId,
              {
                ...batch,
                generations: nextGenerations,
              },
              'createAudio/updatePolledGeneration',
            );

            if (nextPlayableCount > lastPlayableCount) {
              lastPlayableCount = nextPlayableCount;
              message.success(t('generation.readyToPlay', { ns: 'audio' }));
            }
          }
        }

        if (status.status === AsyncTaskStatus.Success || status.status === AsyncTaskStatus.Error) {
          return;
        }
      } catch (error) {
        consecutiveFailures += 1;
        console.error('[CreateAudio] Audio polling failed:', error);

        if (consecutiveFailures >= AUDIO_POLL_MAX_FAILURES) {
          message.error(t('generation.pollingFailed', { ns: 'audio' }));
          return;
        }
      }
    }
  };
}

export type CreateAudioAction = ReturnType<typeof createCreateAudioSlice>;
