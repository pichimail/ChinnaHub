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

  setAudioNegativeTags = (negativeTags?: string): void => {
    this.setAudioParameters({ negativeTags });
  };

  setAudioWeirdness = (weirdness: number): void => {
    this.setAudioParameters({ weirdness: Math.max(1, Math.min(100, Math.round(weirdness))) });
  };

  setAudioStyleInfluence = (audioStyleInfluence: number): void => {
    this.setAudioParameters({
      audioStyleInfluence: Math.max(1, Math.min(100, Math.round(audioStyleInfluence))),
    });
  };

  setAudioModelVersion = (modelVersion: 'V1.0' | 'V2.0' | 'V3.0'): void => {
    this.setAudioParameters({ modelVersion });
  };

  setAudioTitle = (title?: string): void => {
    this.setAudioParameters({ title });
  };

  setAudioArtist = (artist?: string): void => {
    this.setAudioParameters({ artist });
  };

  setAudioImageUrl = (imageUrl?: string | null): void => {
    this.setAudioParameters({ imageUrl: imageUrl || undefined });
  };

  setMakeInstrumental = (makeInstrumental: boolean): void => {
    this.setAudioParameters({ makeInstrumental });
  };

  setAudioProviderMode = (providerMode: 'classic' | 'lyria'): void => {
    this.setAudioParameters({ providerMode });
  };

  initializeAudioConfig = (): void => {
    this.#set({ isInit: true }, false, 'audioGenerationConfig/initializeAudioConfig');
  };
}

export type AudioGenerationConfigAction = ReturnType<typeof createAudioGenerationConfigSlice>;
