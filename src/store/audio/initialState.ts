import { type CreateAudioState, initialCreateAudioState } from './slices/createAudio/initialState';
import {
  type AudioConversationState,
  initialAudioConversationState,
} from './slices/conversation/initialState';
import {
  type AudioGenerationBatchState,
  initialAudioGenerationBatchState,
} from './slices/generationBatch/initialState';
import {
  type AudioGenerationConfigState,
  initialAudioGenerationConfigState,
} from './slices/generationConfig/initialState';
import {
  type AudioGenerationTopicState,
  initialAudioGenerationTopicState,
} from './slices/generationTopic/initialState';

export type AudioStoreState = AudioGenerationConfigState &
  AudioConversationState &
  AudioGenerationTopicState &
  AudioGenerationBatchState &
  CreateAudioState;

export const initialState: AudioStoreState = {
  ...initialAudioGenerationConfigState,
  ...initialAudioConversationState,
  ...initialAudioGenerationTopicState,
  ...initialAudioGenerationBatchState,
  ...initialCreateAudioState,
};
