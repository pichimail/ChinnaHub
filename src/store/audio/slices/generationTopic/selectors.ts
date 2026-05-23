import { type AudioGenerationTopicState } from './initialState';

const activeGenerationTopicId = (s: AudioGenerationTopicState) => s.activeGenerationTopicId;
const generationTopics = (s: AudioGenerationTopicState) => s.generationTopics;
const loadingGenerationTopicIds = (s: AudioGenerationTopicState) => s.loadingGenerationTopicIds;

const isLoadingGenerationTopic = (topicId: string) => (s: AudioGenerationTopicState) =>
  s.loadingGenerationTopicIds.includes(topicId);

export const audioGenerationTopicSelectors = {
  activeGenerationTopicId,
  generationTopics,
  isLoadingGenerationTopic,
  loadingGenerationTopicIds,
};
