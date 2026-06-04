export interface AudioGenerationConfigState {
  /**
   * Marks whether the configuration has been initialized
   */
  isInit: boolean;

  /**
   * Audio generation parameters
   */
  parameters: {
    artist?: string;
    audioStyleInfluence?: number;
    imageUrl?: string;
    makeInstrumental?: boolean;
    negativeTags?: string;
    prompt?: string;
    modelVersion?: 'V1.0' | 'V2.0' | 'V3.0';
    providerMode?: 'classic' | 'lyria';
    style?: string;
    title?: string;
    weirdness?: number;
  };
}

export const initialAudioGenerationConfigState: AudioGenerationConfigState = {
  isInit: false,
  parameters: {
    audioStyleInfluence: 72,
    imageUrl: undefined,
    makeInstrumental: false,
    negativeTags: 'low quality, muddy mix, off key vocals, harsh sound',
    prompt: '',
    modelVersion: 'V3.0',
    providerMode: 'classic',
    style: undefined,
    title: undefined,
    weirdness: 34,
  },
};
