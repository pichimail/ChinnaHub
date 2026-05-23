import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { type StateCreator } from 'zustand/vanilla';

import { createDevtools } from '../middleware/createDevtools';
import { expose } from '../middleware/expose';
import { flattenActions } from '../utils/flattenActions';
import { type ResetableStore, ResetableStoreAction } from '../utils/resetableStore';
import { type AudioStoreState, initialState } from './initialState';
import { type CreateAudioAction, createCreateAudioSlice } from './slices/createAudio/action';
import {
  type AudioGenerationBatchAction,
  createAudioGenerationBatchSlice,
} from './slices/generationBatch/action';
import {
  type AudioGenerationConfigAction,
  createAudioGenerationConfigSlice,
} from './slices/generationConfig/action';
import {
  type AudioGenerationTopicAction,
  createAudioGenerationTopicSlice,
} from './slices/generationTopic/action';

//  ===============  aggregate createStoreFn ============ //

type AudioStoreAction = AudioGenerationConfigAction &
  AudioGenerationTopicAction &
  AudioGenerationBatchAction &
  CreateAudioAction &
  ResetableStore;

export interface AudioStore extends AudioStoreAction, AudioStoreState {}

class AudioStoreResetAction extends ResetableStoreAction<AudioStore> {
  protected readonly resetActionName = 'resetAudioStore';
}

const createStore: StateCreator<AudioStore, [['zustand/devtools', never]]> = (
  ...parameters: Parameters<StateCreator<AudioStore, [['zustand/devtools', never]]>>
) => ({
  ...initialState,
  ...flattenActions<AudioStoreAction>([
    createAudioGenerationConfigSlice(...parameters),
    createAudioGenerationTopicSlice(...parameters),
    createAudioGenerationBatchSlice(...parameters),
    createCreateAudioSlice(...parameters),
    new AudioStoreResetAction(...parameters),
  ]),
});

//  ===============  implement useStore ============ //

const devtools = createDevtools('audio');

export const useAudioStore = createWithEqualityFn<AudioStore>()(
  subscribeWithSelector(devtools(createStore)),
  shallow,
);

expose('audio', useAudioStore);

export const getAudioStoreState = () => useAudioStore.getState();
