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
    makeInstrumental?: boolean;
    prompt?: string;
    style?: string;
    title?: string;
  };
}

export const initialAudioGenerationConfigState: AudioGenerationConfigState = {
  isInit: false,
  parameters: {
    makeInstrumental: false,
    prompt: '',
    style: undefined,
    title: undefined,
  },
};
