import { t } from 'i18next';

import { message } from '@/components/AntdStaticMethods';
import { audioService } from '@/services/audio';
import { type StoreSetter } from '@/store/types';

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
          makeInstrumental: parameters.makeInstrumental,
          prompt: parameters.prompt,
          style: parameters.style,
          title: parameters.title,
        },
        topicId: finalTopicId!,
      });

      if (result.success) {
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
}

export type CreateAudioAction = ReturnType<typeof createCreateAudioSlice>;
