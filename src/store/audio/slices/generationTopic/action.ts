import isEqual from 'fast-deep-equal';
import { type SWRResponse } from 'swr';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { generationTopicService } from '@/services/generationTopic';
import { type StoreSetter } from '@/store/types';
import { type ImageGenerationTopic } from '@/types/generation';

import { type AudioStore } from '../../store';

type Setter = StoreSetter<AudioStore>;
const FETCH_AUDIO_GENERATION_TOPICS_KEY = 'fetchAudioGenerationTopics';

export const createAudioGenerationTopicSlice = (
  set: Setter,
  get: () => AudioStore,
  _api?: unknown,
) => new AudioGenerationTopicActionImpl(set, get, _api);

export class AudioGenerationTopicActionImpl {
  readonly #get: () => AudioStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => AudioStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  switchGenerationTopic = (topicId: string): void => {
    if (this.#get().activeGenerationTopicId === topicId) return;

    this.#set(
      { activeGenerationTopicId: topicId },
      false,
      'audioGenerationTopic/switchGenerationTopic',
    );
  };

  openNewGenerationTopic = (): void => {
    this.#set({ activeGenerationTopicId: null }, false, 'audioGenerationTopic/openNewTopic');
  };

  internal_updateGenerationTopicLoading = (topicId: string, isLoading: boolean): void => {
    const currentLoading = this.#get().loadingGenerationTopicIds;

    const nextLoading = isLoading
      ? [...new Set([...currentLoading, topicId])]
      : currentLoading.filter((id) => id !== topicId);

    this.#set(
      { loadingGenerationTopicIds: nextLoading },
      false,
      'audioGenerationTopic/internal_updateGenerationTopicLoading',
    );
  };

  internal_addGenerationTopic = (topic: ImageGenerationTopic): void => {
    const topics = this.#get().generationTopics;

    if (topics.some((t) => t.id === topic.id)) return;

    this.#set(
      { generationTopics: [topic, ...topics] },
      false,
      'audioGenerationTopic/internal_addGenerationTopic',
    );
  };

  createGenerationTopic = async (prompts: string[]): Promise<string> => {
    const title =
      prompts
        .find((prompt) => prompt.trim())
        ?.trim()
        .slice(0, 80) || 'Accoustica';
    const topicId = await generationTopicService.createTopic('audio', title);

    this.internal_addGenerationTopic({
      coverUrl: null,
      createdAt: new Date(),
      id: topicId,
      title,
      updatedAt: new Date(),
    });

    return topicId;
  };

  refreshGenerationTopics = async (): Promise<void> => {
    await mutate([FETCH_AUDIO_GENERATION_TOPICS_KEY]);
  };

  useFetchGenerationTopics = (enabled: boolean): SWRResponse<ImageGenerationTopic[]> => {
    return useClientDataSWR<ImageGenerationTopic[]>(
      enabled ? [FETCH_AUDIO_GENERATION_TOPICS_KEY] : null,
      () => generationTopicService.getAllGenerationTopics('audio'),
      {
        onError: (error) => {
          console.error('Failed to fetch audio generation topics:', error);
        },
        onSuccess: (data) => {
          if (isEqual(data, this.#get().generationTopics)) return;
          this.#set({ generationTopics: data }, false, 'audioGenerationTopic/useFetchTopics');
        },
        suspense: false,
      },
    );
  };

  removeGenerationTopic = async (id: string): Promise<void> => {
    await generationTopicService.deleteTopic(id);
    await this.refreshGenerationTopics();

    if (this.#get().activeGenerationTopicId === id) {
      const nextTopic = this.#get().generationTopics.find((topic) => topic.id !== id);
      this.#set(
        { activeGenerationTopicId: nextTopic?.id || null },
        false,
        'audioGenerationTopic/removeGenerationTopic',
      );
    }
  };

  setTopicBatchLoaded = (topicId: string): void => {
    // Mark topic as having loaded its batch data
    this.internal_updateGenerationTopicLoading(topicId, false);
  };
}

export type AudioGenerationTopicAction = ReturnType<typeof createAudioGenerationTopicSlice>;
