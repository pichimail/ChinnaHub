import { type AudioStore } from '../../store';

export const audioConversationSelectors = {
  lastTrack: (state: AudioStore) => state.lastConversationTrack,
  messages: (state: AudioStore) => state.conversationMessages,
};
