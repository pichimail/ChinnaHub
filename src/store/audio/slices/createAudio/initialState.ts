export interface CreateAudioState {
  isCreating: boolean;
  isCreatingWithNewTopic: boolean;
}

export const initialCreateAudioState: CreateAudioState = {
  isCreating: false,
  isCreatingWithNewTopic: false,
};
