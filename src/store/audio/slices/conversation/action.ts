import { type StoreSetter } from '@/store/types';

import { type AudioStore } from '../../store';
import {
  type AudioConversationMessage,
  type AudioConversationTrackContext,
} from './initialState';

type Setter = StoreSetter<AudioStore>;

const createId = () => `audio-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createAudioConversationSlice = (set: Setter, get: () => AudioStore, _api?: unknown) =>
  new AudioConversationActionImpl(set, get, _api);

export class AudioConversationActionImpl {
  readonly #get: () => AudioStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => AudioStore, _api?: unknown) {
    void _api;
    this.#get = get;
    this.#set = set;
  }

  appendAudioMessage = (message: Omit<AudioConversationMessage, 'createdAt' | 'id'>): void => {
    const nextMessage: AudioConversationMessage = {
      ...message,
      createdAt: Date.now(),
      id: createId(),
    };

    this.#set(
      {
        conversationMessages: [...this.#get().conversationMessages, nextMessage].slice(-80),
      },
      false,
      'audioConversation/appendAudioMessage',
    );
  };

  clearAudioConversation = (): void => {
    this.#set(
      { conversationMessages: [], lastConversationTrack: undefined },
      false,
      'audioConversation/clearAudioConversation',
    );
  };

  setLastAudioTrackContext = (trackContext?: AudioConversationTrackContext): void => {
    this.#set({ lastConversationTrack: trackContext }, false, 'audioConversation/setLastTrack');
  };
}

export type AudioConversationAction = ReturnType<typeof createAudioConversationSlice>;
