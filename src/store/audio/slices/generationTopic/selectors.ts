import { type AudioStoreState } from '../../initialState';

const activeGenerationTopicId = (s: AudioStoreState) => s.activeGenerationTopicId;
const generationTopics = (s: AudioStoreState) => s.generationTopics;
const getGenerationTopicById = (id: string) => (s: AudioStoreState) =>
  s.generationTopics.find((topic) => topic.id === id);
const isLoadingGenerationTopic = (id: string) => (s: AudioStoreState) =>
  s.loadingGenerationTopicIds.includes(id);

export const generationTopicSelectors = {
  activeGenerationTopicId,
  generationTopics,
  getGenerationTopicById,
  isLoadingGenerationTopic,
};
