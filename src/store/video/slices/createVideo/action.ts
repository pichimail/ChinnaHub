import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { t } from 'i18next';

import { handleGenerationPromptModerationError } from '@/business/client/handleGenerationPromptModerationError';
import { handleLobeHubModelDeprecatedError } from '@/business/client/handleLobeHubModelDeprecatedError';
import { markUserValidAction } from '@/business/client/markUserValidAction';
import { message } from '@/components/AntdStaticMethods';
import { grokImagineService } from '@/services/grokImagine';
import { videoService } from '@/services/video';
import { type StoreSetter } from '@/store/types';
import { isChinnaVideoModel, resolveChinnaVideoMode, toKieInput } from '@/utils/grokImagineRouting';

import { type VideoStore } from '../../store';
import { generationBatchSelectors } from '../generationBatch/selectors';
import { videoGenerationConfigSelectors } from '../generationConfig/selectors';
import { generationTopicSelectors } from '../generationTopic';

type Setter = StoreSetter<VideoStore>;

export const createCreateVideoSlice = (set: Setter, get: () => VideoStore, _api?: unknown) =>
  new CreateVideoActionImpl(set, get, _api);

export class CreateVideoActionImpl {
  readonly #get: () => VideoStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => VideoStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  createVideo = async (): Promise<void> => {
    this.#set({ isCreating: true }, false, 'createVideo/startCreateVideo');

    const store = this.#get();
    const parameters = videoGenerationConfigSelectors.parameters(store);
    const provider = videoGenerationConfigSelectors.provider(store);
    const model = videoGenerationConfigSelectors.model(store);
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    const { createGenerationTopic, switchGenerationTopic, setTopicBatchLoaded } = store;

    if (!parameters) throw new TypeError('parameters is not initialized');
    if (!parameters.prompt) throw new TypeError('prompt is empty');

    const parametersSchema = videoGenerationConfigSelectors.parametersSchema(store);
    const endImageUrlSchema = parametersSchema?.endImageUrl;
    if (
      endImageUrlSchema &&
      'requiresImageUrl' in endImageUrlSchema &&
      endImageUrlSchema.requiresImageUrl &&
      parameters.endImageUrl &&
      !parameters.imageUrl &&
      !parameters.imageUrls?.length
    ) {
      message.warning({
        content: t('generation.validation.endFrameRequiresStartFrame', { ns: 'video' }),
        duration: 3,
      });
      this.#set({ isCreating: false }, false, 'createVideo/endCreateVideo');
      return;
    }

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
        this.#set({ isCreatingWithNewTopic: true }, false, 'createVideo/startCreateVideoWithNewTopic');
      }

      if (ENABLE_BUSINESS_FEATURES) markUserValidAction();

      if (isChinnaVideoModel(provider, model)) {
        const mode = resolveChinnaVideoMode(model, parameters as any);
        if (mode === 'auto-video') await grokImagineService.runChinnaAutoVideo(parameters as any);
        else await grokImagineService.createKieTask(mode as any, toKieInput(parameters as any));
      } else {
        await videoService.createVideo({
          generationTopicId: finalTopicId!,
          model,
          params: parameters as any,
          provider,
        });
      }

      await this.#get().refreshGenerationBatches();

      this.#set(
        (state) => ({ parameters: { ...state.parameters, prompt: '' } }),
        false,
        'createVideo/clearPrompt',
      );
    } catch (error) {
      handleGenerationPromptModerationError(error);
      handleLobeHubModelDeprecatedError(error);
      throw error;
    } finally {
      if (isNewTopic) {
        this.#set({ isCreating: false, isCreatingWithNewTopic: false }, false, 'createVideo/endCreateVideoWithNewTopic');
      } else {
        this.#set({ isCreating: false }, false, 'createVideo/endCreateVideo');
      }
    }
  };

  recreateVideo = async (generationBatchId: string): Promise<void> => {
    this.#set({ isCreating: true }, false, 'recreateVideo/start');

    const store = this.#get();
    const activeGenerationTopicId = generationTopicSelectors.activeGenerationTopicId(store);
    if (!activeGenerationTopicId) throw new Error('No active generation topic');

    const { removeGenerationBatch } = store;
    const batch = generationBatchSelectors.getGenerationBatchByBatchId(generationBatchId)(store)!;

    try {
      await removeGenerationBatch(generationBatchId, activeGenerationTopicId);
      await videoService.createVideo({
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
      this.#set({ isCreating: false }, false, 'recreateVideo/end');
    }
  };
}

export type CreateVideoAction = Pick<CreateVideoActionImpl, keyof CreateVideoActionImpl>;
