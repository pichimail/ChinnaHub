import { type AudioGenerationConfigState } from './initialState';

const model = (s: AudioGenerationConfigState) => s.model;
const provider = (s: AudioGenerationConfigState) => s.provider;
const parameters = (s: AudioGenerationConfigState) => s.parameters;

export const audioGenerationConfigSelectors = {
  model,
  parameters,
  provider,
};
