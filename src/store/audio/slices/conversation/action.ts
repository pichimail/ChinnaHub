import { type StoreSetter } from '@/store/types';

import { type AudioStore } from '../../store';
import {
  type AudioConversationMessage,
  type AudioConversationTrackContext,
} from './initialState';

type Setter = StoreSetter<AudioStore>;

const AUDIO_CONVERSATION_STORAGE_KEY = 'chinnahub:audio:conversation:v1';

const createId = () => `audio-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const persistConversation = (state: Pick<AudioStore, 'conversationMessages' | 'lastConversationTrack'>) => {
  if (!canUseStorage()) return;

  window.localStorage.setItem(
    AUDIO_CONVERSATION_STORAGE_KEY,
    JSON.stringify({
      conversationMessages: state.conversationMessages.slice(-80),
      lastConversationTrack: state.lastConversationTrack,
    }),
  );
};

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
    const conversationMessages = [...this.#get().conversationMessages, nextMessage].slice(-80);

    this.#set(
      {
        conversationMessages,
      },
      false,
      'audioConversation/appendAudioMessage',
    );
    persistConversation({ conversationMessages, lastConversationTrack: this.#get().lastConversationTrack });
  };

  clearAudioConversation = (): void => {
    this.#set(
      { conversationMessages: [], lastConversationTrack: undefined },
      false,
      'audioConversation/clearAudioConversation',
    );

    if (canUseStorage()) window.localStorage.removeItem(AUDIO_CONVERSATION_STORAGE_KEY);
  };

  hydrateAudioConversation = (): void => {
    if (!canUseStorage() || this.#get().conversationMessages.length > 0) return;

    try {
      const raw = window.localStorage.getItem(AUDIO_CONVERSATION_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<Pick<AudioStore, 'conversationMessages' | 'lastConversationTrack'>>;
      this.#set(
        {
          conversationMessages: Array.isArray(parsed.conversationMessages)
            ? parsed.conversationMessages.slice(-80)
            : [],
          lastConversationTrack: parsed.lastConversationTrack,
        },
        false,
        'audioConversation/hydrateAudioConversation',
      );
    } catch (error) {
      console.warn('[AudioConversation] Failed to hydrate persisted conversation:', error);
    }
  };

  setLastAudioTrackContext = (trackContext?: AudioConversationTrackContext): void => {
    this.#set({ lastConversationTrack: trackContext }, false, 'audioConversation/setLastTrack');
    persistConversation({
      conversationMessages: this.#get().conversationMessages,
      lastConversationTrack: trackContext,
    });
  };
}

export type AudioConversationAction = ReturnType<typeof createAudioConversationSlice>;
