import { type AudioGenerationConfigState } from './initialState';

export const audioGenerationConfigSelectors = {
  customMode: (s: AudioGenerationConfigState) => s.customMode,
  prompt: (s: AudioGenerationConfigState) => s.prompt,
  lyrics: (s: AudioGenerationConfigState) => s.lyrics,
  songTitle: (s: AudioGenerationConfigState) => s.songTitle,
  stylePrompt: (s: AudioGenerationConfigState) => s.stylePrompt,
  makeInstrumental: (s: AudioGenerationConfigState) => s.makeInstrumental,
  model: (s: AudioGenerationConfigState) => s.model,
  provider: (s: AudioGenerationConfigState) => s.provider,
  isInit: (s: AudioGenerationConfigState) => s.isInit,
};
