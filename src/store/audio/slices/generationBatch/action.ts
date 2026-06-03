import isEqual from 'fast-deep-equal';
import { type SWRResponse } from 'swr';

import { useClientDataSWR } from '@/libs/swr';
import { generationBatchService } from '@/services/generationBatch';
import { type StoreSetter } from '@/store/types';
import { type GenerationBatch } from '@/types/generation';

import { type AudioStore } from '../../store';

type Setter = StoreSetter<AudioStore>;
const SWR_USE_FETCH_AUDIO_GENERATION_BATCHES = 'SWR_USE_FETCH_AUDIO_GENERATION_BATCHES';

export const createAudioGenerationBatchSlice = (
  set: Setter,
  get: () => AudioStore,
  _api?: unknown,
) => new AudioGenerationBatchActionImpl(set, get, _api);

export class AudioGenerationBatchActionImpl {
  readonly #get: () => AudioStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => AudioStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  internal_dispatchGenerationBatch = (
    topicId: string,
    batch: Partial<GenerationBatch>,
    action?: string,
  ): void => {
    const currentMap = this.#get().generationBatchesMap;
    const batches = currentMap[topicId] || [];

    const existingBatch = batch.id ? batches.find((b) => b.id === batch.id) : undefined;
    const nextBatches =
      batch.id && existingBatch
        ? batches.map((b) => (b.id === batch.id ? { ...b, ...batch } : b))
        : [{ ...batch, id: batch.id || Date.now().toString() } as GenerationBatch, ...batches];

    const nextMap = {
      ...currentMap,
      [topicId]: nextBatches,
    };

    this.#set(
      { generationBatchesMap: nextMap },
      false,
      action ?? 'audioGenerationBatch/dispatchGenerationBatch',
    );
  };

  internal_deleteGeneration = async (generationId: string): Promise<void> => {
    const { activeGenerationTopicId } = this.#get();
    if (!activeGenerationTopicId) return;

    const currentBatches = this.#get().generationBatchesMap[activeGenerationTopicId] || [];
    const targetBatch = currentBatches.find((batch) =>
      batch.generations.some((gen) => gen.id === generationId),
    );

    if (!targetBatch) return;

    this.internal_dispatchGenerationBatch(
      activeGenerationTopicId,
      {
        generations: targetBatch.generations.filter((g) => g.id !== generationId),
        id: targetBatch.id,
      },
      'audioGenerationBatch/internal_deleteGeneration',
    );
  };

  refreshGenerationBatches = async (): Promise<void> => {
    const { activeGenerationTopicId } = this.#get();
    if (!activeGenerationTopicId) return;

    const batches = await generationBatchService.getGenerationBatches(
      activeGenerationTopicId,
      'audio',
    );

    this.#set(
      {
        generationBatchesMap: {
          ...this.#get().generationBatchesMap,
          [activeGenerationTopicId]: batches,
        },
      },
      false,
      'audioGenerationBatch/refreshGenerationBatches',
    );
  };

  useFetchGenerationBatches = (topicId?: string | null): SWRResponse<GenerationBatch[]> => {
    return useClientDataSWR<GenerationBatch[]>(
      topicId ? [SWR_USE_FETCH_AUDIO_GENERATION_BATCHES, topicId] : null,
      async ([, targetTopicId]: [string, string]) =>
        generationBatchService.getGenerationBatches(targetTopicId, 'audio'),
      {
        onError: (error) => {
          console.error('Failed to fetch audio generation batches:', error);
        },
        onSuccess: (data) => {
          if (!topicId) return;

          const nextMap = {
            ...this.#get().generationBatchesMap,
            [topicId]: data,
          };

          if (isEqual(nextMap, this.#get().generationBatchesMap)) return;

          this.#set(
            { generationBatchesMap: nextMap },
            false,
            'audioGenerationBatch/useFetchGenerationBatches',
          );
        },
      },
    );
  };
}

export type AudioGenerationBatchAction = ReturnType<typeof createAudioGenerationBatchSlice>;
