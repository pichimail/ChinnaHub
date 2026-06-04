export type AudioConversationRole = 'assistant' | 'user';

export type AudioConversationIntent = 'generate' | 'followUp' | 'edit' | 'ready' | 'error';

export interface AudioConversationTrackContext {
  artist?: string;
  batchId?: string;
  generationId?: string;
  prompt?: string;
  title?: string;
  url?: string;
}

export interface AudioConversationMessage {
  content: string;
  createdAt: number;
  id: string;
  intent?: AudioConversationIntent;
  role: AudioConversationRole;
  topicId?: string;
  trackContext?: AudioConversationTrackContext;
}

export interface AudioConversationState {
  conversationMessages: AudioConversationMessage[];
  lastConversationTrack?: AudioConversationTrackContext;
}

export const initialAudioConversationState: AudioConversationState = {
  conversationMessages: [],
  lastConversationTrack: undefined,
};
