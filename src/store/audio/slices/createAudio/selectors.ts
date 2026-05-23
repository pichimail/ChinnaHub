import { type CreateAudioState } from './initialState';

const isCreating = (s: CreateAudioState) => s.isCreating;
const isCreatingWithNewTopic = (s: CreateAudioState) => s.isCreatingWithNewTopic;

export const createAudioSelectors = {
  isCreating,
  isCreatingWithNewTopic,
};
