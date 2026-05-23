import { type AudioStore } from '../../store';

const isCreating = (state: AudioStore) => state.isCreating;
const isCreatingWithNewTopic = (state: AudioStore) => state.isCreatingWithNewTopic;

export const createAudioSelectors = {
  isCreating,
  isCreatingWithNewTopic,
};
