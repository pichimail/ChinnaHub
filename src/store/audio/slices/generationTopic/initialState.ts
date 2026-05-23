import { type ImageGenerationTopic } from '@/types/generation';

export interface AudioGenerationTopicState {
  activeGenerationTopicId: string | null;
  generationTopics: ImageGenerationTopic[];
  loadingGenerationTopicIds: string[];
}

export const initialAudioGenerationTopicState: AudioGenerationTopicState = {
  activeGenerationTopicId:
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('topic') : null,
  generationTopics: [],
  loadingGenerationTopicIds: [],
};
