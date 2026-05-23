import { type StoreSetter } from '@/store/types';

import { type AudioStore } from '../../store';
import { type AudioGenerationConfigState } from './initialState';

type Setter = StoreSetter<AudioStore>;

export const createAudioGenerationConfigSlice = (
  set: Setter,
  get: () => AudioStore,
  _api?: unknown,
) => new AudioGenerationConfigActionImpl(set, get, _api);

export class AudioGenerationConfigActionImpl {
  readonly #get: () => AudioStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => AudioStore, _api?: unknown) {
    void _api;
    this.#get = get;
    this.#set = set;
  }

  setAudioParameters = (parameters: Partial<AudioGenerationConfigState['parameters']>): void => {
    const current = this.#get().parameters;

    this.#set(
      {
        parameters: {
          ...current,
          ...parameters,
        },
      },
      false,
      'audioGenerationConfig/setAudioParameters',
    );
  };

  setAudioPrompt = (prompt: string): void => {
    this.setAudioParameters({ prompt });
  };

  setAudioStyle = (style?: string): void => {
    this.setAudioParameters({ style });
  };

  setAudioTitle = (title?: string): void => {
    this.setAudioParameters({ title });
  };

  setMakeInstrumental = (makeInstrumental: boolean): void => {
    this.setAudioParameters({ makeInstrumental });
  };

  initializeAudioConfig = (): void => {
    this.#set({ isInit: true }, false, 'audioGenerationConfig/initializeAudioConfig');
  };
}

export type AudioGenerationConfigAction = ReturnType<typeof createAudioGenerationConfigSlice>;
