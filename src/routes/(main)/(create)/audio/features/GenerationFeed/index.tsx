'use client';

import { memo } from 'react';

import GenerationFeed from '@/routes/(main)/(create)/features/GenerationFeed';
import { useAudioStore } from '@/store/audio';
import { generationBatchSelectors } from '@/store/audio/selectors';

import { AudioGenerationBatchItem } from './BatchItem';

const AudioGenerationFeed = memo(() => {
  const currentGenerationBatches = useAudioStore(generationBatchSelectors.currentGenerationBatches);

  return (
    <GenerationFeed
      batches={currentGenerationBatches ?? []}
      renderBatchItem={(batch) => <AudioGenerationBatchItem batch={batch} key={batch.id} />}
    />
  );
});

AudioGenerationFeed.displayName = 'AudioGenerationFeed';

export default AudioGenerationFeed;
