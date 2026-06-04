import { lambdaClient } from '@/libs/trpc/client';

export type AudioActionPayload = Record<string, unknown>;
export type AudioActionQuery = Record<string, string | undefined>;

const mutate = (name: keyof typeof lambdaClient.audioAction, payload: AudioActionPayload = {}) => {
  const action = lambdaClient.audioAction[name] as { mutate: (input: { payload: AudioActionPayload }) => Promise<unknown> };
  return action.mutate({ payload });
};

const query = (name: keyof typeof lambdaClient.audioAction, params: AudioActionQuery = {}) => {
  const action = lambdaClient.audioAction[name] as { query: (input: { query: AudioActionQuery }) => Promise<unknown> };
  return action.query({ query: params });
};

export const audioActionService = {
  addInstrumental: (payload: AudioActionPayload) => mutate('addInstrumental', payload),
  addVocals: (payload: AudioActionPayload) => mutate('addVocals', payload),
  boostStyle: (payload: AudioActionPayload) => mutate('boostStyle', payload),
  checkVoiceAvailability: (payload: AudioActionPayload) => mutate('checkVoiceAvailability', payload),
  convertDownloadUrl: (payload: AudioActionPayload) => mutate('convertDownloadUrl', payload),
  createCustomVoice: (payload: AudioActionPayload) => mutate('createCustomVoice', payload),
  extendMusic: (payload: AudioActionPayload) => mutate('extendMusic', payload),
  generateMashup: (payload: AudioActionPayload) => mutate('generateMashup', payload),
  generateMusicCover: (payload: AudioActionPayload) => mutate('generateMusicCover', payload),
  generatePersona: (payload: AudioActionPayload) => mutate('generatePersona', payload),
  getCredit: () => query('getCredit'),
  getCustomVoiceRecords: (params: AudioActionQuery = {}) => query('getCustomVoiceRecords', params),
  getMusicDetails: (taskId: string) => query('getMusicDetails', { taskId }),
  getTimestampedLyrics: (payload: AudioActionPayload) => mutate('getTimestampedLyrics', payload),
  getVoiceVerificationPhrase: (taskId: string) => query('getVoiceVerificationPhrase', { taskId }),
  regenerateVoiceVerificationPhrase: (payload: AudioActionPayload) => mutate('regenerateVoiceVerificationPhrase', payload),
  replaceSection: (payload: AudioActionPayload) => mutate('replaceSection', payload),
  separateVocals: (payload: AudioActionPayload) => mutate('separateVocals', payload),
  uploadAndCoverAudio: (payload: AudioActionPayload) => mutate('uploadAndCoverAudio', payload),
  uploadAndExtendAudio: (payload: AudioActionPayload) => mutate('uploadAndExtendAudio', payload),
  uploadFileFromBase64: (payload: AudioActionPayload) => mutate('uploadFileFromBase64', payload),
  voiceGenerateVerificationPhrase: (payload: AudioActionPayload) => mutate('voiceGenerateVerificationPhrase', payload),
};
