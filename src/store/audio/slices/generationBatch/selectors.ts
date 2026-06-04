import { type AudioGenerationBatchState } from './initialState';

const generationBatchesMap = (s: AudioGenerationBatchState) => s.generationBatchesMap;

const batches = (topicId: string) => (s: AudioGenerationBatchState) =>
  s.generationBatchesMap[topicId] || [];

const currentGenerationBatches = (
  s: AudioGenerationBatchState & { activeGenerationTopicId?: string | null },
) => (s.activeGenerationTopicId ? s.generationBatchesMap[s.activeGenerationTopicId] || [] : []);

export const audioGenerationBatchSelectors = {
  batches,
  currentGenerationBatches,
  generationBatchesMap,
};
