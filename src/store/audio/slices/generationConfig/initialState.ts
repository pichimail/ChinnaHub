export interface AudioGenerationParams {
  customMode: boolean;
  instrumental: boolean;
  negativeTags?: string;
  prompt: string;
  style?: string;
  title?: string;
}

export interface AudioGenerationConfigState {
  isInit: boolean;
  model: string;
  parameters: AudioGenerationParams;
  provider: string;
}

export const initialGenerationConfigState: AudioGenerationConfigState = {
  isInit: false,
  model: 'audio-default',
  parameters: {
    customMode: false,
    instrumental: false,
    prompt: '',
    style: '',
    title: '',
  },
  provider: 'audio',
};
