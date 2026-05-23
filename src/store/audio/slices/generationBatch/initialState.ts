import { type GenerationBatch } from '@/types/generation';

export interface AudioGenerationBatchState {
  generationBatchesMap: Record<string, GenerationBatch[]>;
}

export const initialAudioGenerationBatchState: AudioGenerationBatchState = {
  generationBatchesMap: {},
};
