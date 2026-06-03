export interface AudioGenerationConfigState {
  /**
   * Marks whether the configuration has been initialized
   */
  isInit: boolean;

  /**
   * Audio generation parameters
   * {
   *   prompt: string (required) - music description
   *   style?: string - music style/genre
   *   title?: string - track title
   *   makeInstrumental?: boolean - generate instrumental version
   * }
   */
  parameters: {
    artist?: string;
    imageUrl?: string;
    makeInstrumental?: boolean;
    prompt?: string;
    modelVersion?: 'V1.0' | 'V2.0' | 'V3.0';
    providerMode?: 'classic' | 'lyria';
    style?: string;
    title?: string;
  };
}

export const initialAudioGenerationConfigState: AudioGenerationConfigState = {
  isInit: false,
  parameters: {
    imageUrl: undefined,
    makeInstrumental: false,
    prompt: '',
    modelVersion: 'V3.0',
    providerMode: 'classic',
    style: undefined,
    title: undefined,
  },
};
