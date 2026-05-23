import { type AudioGenerationBatchState } from './initialState';

const generationBatchesMap = (s: AudioGenerationBatchState) => s.generationBatchesMap;

const batches = (topicId: string) => (s: AudioGenerationBatchState) =>
  s.generationBatchesMap[topicId] || [];

export const audioGenerationBatchSelectors = {
  batches,
  generationBatchesMap,
};
