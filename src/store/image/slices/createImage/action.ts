import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { markUserValidAction } from '@/business/client/markUserValidAction';
import { grokImagineService } from '@/services/grokImagine';
import { imageService } from '@/services/image';
import { type StoreSetter } from '@/store/types';
import { isChinnaImageModel, resolveChinnaImageMode, toKieInput } from '@/utils/grokImagineRouting';

import { type ImageStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { imageGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

type Setter = StoreSetter<ImageStore>;
export const createCreateImageSlice = (set: Setter, get: () => ImageStore, _api?: unknown) =>
  new CreateImageActionImpl(set, get, _api);

export class CreateImageActionImpl {
  readonly #get: () => ImageStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => ImageStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  async createImage() {
    this.#set({ isCreating: true }, false, 'createImage/startCreateImage');

    const store = this.#get();
    const imageNum = imageGenerationConfigSelectors.imageNum(store);
    const parameters = imageGenerationConfigSelectors.parameters(store);
    const provider = imageGenerationConfigSelectors.provider(store);
    const model = imageGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    if (!parameters) throw new TypeError('parameters is not initialized');
    if (!parameters.prompt) throw new TypeError('prompt is empty');

    let finalTopicId = activeGenerationTopicId;
    const generationTopicId = activeGenerationTopicId;
    let isNewTopic = false;

    if (!generationTopicId) {
      isNewTopic = true;
      const newGenerationTopicId = await createGenerationTopic([parameters.prompt]);
      finalTopicId = newGenerationTopicId;
      setTopicBatchLoaded(newGenerationTopicId);
      switchGenerationTopic(newGenerationTopicId);
    }

    try {
      if (isNewTopic) {
        this.#set({ isCreatingWithNewTopic: true }, false, 'createImage/startCreateImageWithNewTopic');
      }

      if (ENABLE_BUSINESS_FEATURES) markUserValidAction();

      if (isChinnaImageModel(provider, model)) {
        const mode = resolveChinnaImageMode(model, parameters as any);
        if (mode === 'auto-image') await grokImagineService.runChinnaAutoImage(parameters as any);
        else await grokImagineService.createKieTask(mode as any, toKieInput(parameters as any));
      } else {
        await imageService.createImage({
          generationTopicId: finalTopicId!,
          imageNum,
          model,
          params: parameters as any,
          provider,
        });
      }

      await this.#get().refreshGenerationBatches();

      this.#set(
        (state) => ({ parameters: { ...state.parameters, prompt: '' } }),
        false,
        'createImage/clearPrompt',
      );
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      if (isNewTopic) {
        this.#set({ isCreating: false, isCreatingWithNewTopic: false }, false, 'createImage/endCreateImageWithNewTopic');
      } else {
        this.#set({ isCreating: false }, false, 'createImage/endCreateImage');
      }
    }
  }

  async recreateImage(generationBatchId: string) {
    this.#set({ isCreating: true }, false, 'recreateImage/startCreateImage');

    const store = this.#get();
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    if (!activeGenerationTopicId) throw new Error('No active generation topic');

    const { removeGenerationBatch } = store;
    const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store)!;
    const imageNum = batch.generations.length;

    try {
      await removeGenerationBatch(generationBatchId, activeGenerationTopicId);
      await imageService.createImage({
        generationTopicId: activeGenerationTopicId,
        imageNum,
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
      this.#set({ isCreating: false }, false, 'recreateImage/endCreateImage');
    }
  }
}

export type CreateImageAction = Pick<CreateImageActionImpl, keyof CreateImageActionImpl>;
