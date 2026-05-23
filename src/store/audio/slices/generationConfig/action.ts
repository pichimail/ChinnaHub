import { type StoreSetter } from '@/store/types';

import type { AudioStore } from '../../store';

type Setter = StoreSetter<AudioStore>;

export const createGenerationConfigSlice = (set: Setter, get: () => AudioStore, _api?: unknown) =>
  new GenerationConfigActionImpl(set, get, _api);

export class GenerationConfigActionImpl {
  readonly #set: Setter;

  constructor(set: Setter, _get: () => AudioStore, _api?: unknown) {
    void _get;
    void _api;
    this.#set = set;
  }

  initializeAudioConfig = (): void => {
    this.#set({ isInit: true }, false, 'initializeAudioConfig/default');
  };

  setModelAndProviderOnSelect = (): void => {
    // Audio generation uses a fixed backend model/provider.
  };

  setParamOnInput = (
    paramName: 'customMode' | 'instrumental' | 'negativeTags' | 'prompt' | 'style' | 'title',
    value: boolean | string,
  ): void => {
    this.#set(
      (state) => {
        const { parameters } = state;
        return { parameters: { ...parameters, [paramName]: value } };
      },
      false,
      `setParamOnInput/${paramName}`,
    );
  };
}

export type GenerationConfigAction = Pick<
  GenerationConfigActionImpl,
  keyof GenerationConfigActionImpl
>;
