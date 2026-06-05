export const CHINNA_AUDIO_PROVIDER = 'chinnahub';
export const CHINNA_AUDIO_MODEL = 'chinnaaudio';

export interface AudioGenerationConfigState {
  /** Whether custom mode is active (user provides lyrics + style vs AI-generated) */
  customMode: boolean;
  /** Simple mode song description */
  prompt: string;
  /** Custom mode lyrics */
  lyrics: string;
  /** Song title, optional */
  songTitle: string;
  /** Music style tags, e.g. "pop rock energetic" */
  stylePrompt: string;
  /** Whether to generate instrumental (no vocals) */
  makeInstrumental: boolean;
  /** Selected Accoustica model id */
  model: string;
  /** Selected generation provider id */
  provider: string;
  /** Marks whether the configuration has been initialized */
  isInit: boolean;
}

export const initialGenerationConfigState: AudioGenerationConfigState = {
  customMode: false,
  prompt: '',
  lyrics: '',
  songTitle: '',
  stylePrompt: '',
  makeInstrumental: false,
  model: CHINNA_AUDIO_MODEL,
  provider: CHINNA_AUDIO_PROVIDER,
  isInit: true,
};
