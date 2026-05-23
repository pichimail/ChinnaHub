import { type CreateAudioState, initialCreateAudioState } from './slices/createAudio/initialState';
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
  AudioGenerationTopicState &
  AudioGenerationBatchState &
  CreateAudioState;

export const initialState: AudioStoreState = {
  ...initialAudioGenerationConfigState,
  ...initialAudioGenerationTopicState,
  ...initialAudioGenerationBatchState,
  ...initialCreateAudioState,
};
