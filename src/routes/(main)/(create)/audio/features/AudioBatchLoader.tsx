'use client';

import { memo } from 'react';

import { audioGenerationTopicSelectors, useAudioStore } from '@/store/audio';

const AudioBatchLoader = memo(() => {
  const topicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const useFetchGenerationBatches = useAudioStore((s) => s.useFetchGenerationBatches);
  useFetchGenerationBatches(topicId);

  return null;
});

AudioBatchLoader.displayName = 'AudioBatchLoader';
export default AudioBatchLoader;
