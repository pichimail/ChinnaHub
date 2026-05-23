import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { t } from 'i18next';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { markUserValidAction } from '@/business/client/markUserValidAction';
import { message } from '@/components/AntdStaticMethods';
import { audioService } from '@/services/audio';
import { type StoreSetter } from '@/store/types';

import { type AudioStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { audioGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

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
    const provider = audioGenerationConfigSelectors.provider(store);
    const model = audioGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    if (!parameters) {
      throw new TypeError('parameters is not initialized');
    }

    if (!parameters.prompt) {
      throw new TypeError('prompt is empty');
    }

    if (parameters.customMode) {
      if (!parameters.style?.trim()) {
        message.warning({ content: t('config.style.placeholder', { ns: 'audio' }), duration: 2 });
        this.#set({ isCreating: false }, false, 'createAudio/invalidStyle');
        return;
      }
      if (!parameters.title?.trim()) {
        message.warning({ content: t('config.title.placeholder', { ns: 'audio' }), duration: 2 });
        this.#set({ isCreating: false }, false, 'createAudio/invalidTitle');
        return;
      }
    }

    let finalTopicId = activeGenerationTopicId;

    // 1. Create generation topic if not exists
    const generationTopicId = activeGenerationTopicId;
    let isNewTopic = false;

    if (!generationTopicId) {
      isNewTopic = true;
      const prompts = [parameters.prompt];
      const newGenerationTopicId = await createGenerationTopic(prompts);
      finalTopicId = newGenerationTopicId;

      // 2. Initialize empty batch array to avoid skeleton screen
      setTopicBatchLoaded(newGenerationTopicId);

      // 3. Switch to the new topic (now it has empty data, so no skeleton screen)
      switchGenerationTopic(newGenerationTopicId);
    }

    try {
      // 3. If it's a new topic, set the creating state after topic creation
      if (isNewTopic) {
        this.#set(
          { isCreatingWithNewTopic: true },
          false,
          'createAudio/startCreateAudioWithNewTopic',
        );
      }

      if (ENABLE_BUSINESS_FEATURES) {
        markUserValidAction();
      }

      // 4. Create audio via service
      await audioService.createAudio({
        generationTopicId: finalTopicId!,
        model,
        params: parameters as any,
        provider,
      });

      // 5. Refresh generation batches to show the new batch
      if (!isNewTopic) {
        await this.#get().refreshGenerationBatches();
      }

      // 6. Clear the prompt input after successful audio creation
      this.#set(
        (state) => ({
          parameters: { ...state.parameters, prompt: '' },
        }),
        false,
        'createAudio/clearPrompt',
      );
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      // 7. Reset all creating states
      if (isNewTopic) {
        this.#set(
          { isCreating: false, isCreatingWithNewTopic: false },
          false,
          'createAudio/endCreateAudioWithNewTopic',
        );
      } else {
        this.#set({ isCreating: false }, false, 'createAudio/endCreateAudio');
      }
    }
  };

  recreateAudio = async (generationBatchId: string): Promise<void> => {
    this.#set({ isCreating: true }, false, 'recreateAudio/start');

    const store = this.#get();
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    if (!activeGenerationTopicId) {
      throw new Error('No active generation topic');
    }

    const { removeGenerationBatch } = store;
    const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store)!;

    try {
      await removeGenerationBatch(generationBatchId, activeGenerationTopicId);

      await audioService.createAudio({
        generationTopicId: activeGenerationTopicId,
        model: batch.model,
        params: batch.config as any,
        provider: batch.provider,
      });

      await store.refreshGenerationBatches();
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      this.#set({ isCreating: false }, false, 'recreateAudio/end');
    }
  };
}

export type CreateAudioAction = Pick<CreateAudioActionImpl, keyof CreateAudioActionImpl>;
