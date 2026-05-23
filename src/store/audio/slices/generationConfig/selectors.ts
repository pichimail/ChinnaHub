import { type AudioGenerationConfigState } from './initialState';

const parameters = (s: AudioGenerationConfigState) => s.parameters;
const isInit = (s: AudioGenerationConfigState) => s.isInit;

export const audioGenerationConfigSelectors = {
  isInit,
  parameters,
};
