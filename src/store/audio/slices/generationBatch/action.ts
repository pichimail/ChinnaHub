import { type StoreSetter } from '@/store/types';
import { type GenerationBatch } from '@/types/generation';

import { type AudioStore } from '../../store';

type Setter = StoreSetter<AudioStore>;

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

    const nextBatches = batch.id
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
    // Batches are managed by the API, refresh would be called after operations
  };
}

export type AudioGenerationBatchAction = ReturnType<typeof createAudioGenerationBatchSlice>;
