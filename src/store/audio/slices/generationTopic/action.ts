import { type StoreSetter } from '@/store/types';
import { type ImageGenerationTopic } from '@/types/generation';

import { type AudioStore } from '../../store';

type Setter = StoreSetter<AudioStore>;

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
    this.#set(
      { activeGenerationTopicId: topicId },
      false,
      'audioGenerationTopic/switchGenerationTopic',
    );
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

  refreshGenerationTopics = async (): Promise<void> => {
    // Topics are managed by the API, refresh would be called after operations
    // For now, this is a placeholder for future topic refresh logic
  };

  setTopicBatchLoaded = (topicId: string): void => {
    // Mark topic as having loaded its batch data
    this.internal_updateGenerationTopicLoading(topicId, false);
  };
}

export type AudioGenerationTopicAction = ReturnType<typeof createAudioGenerationTopicSlice>;
