'use client';

import GenerationLayout from '@/routes/(main)/(create)/features/GenerationLayout';
import { audioGenerationTopicSelectors, useAudioStore } from '@/store/audio';

const AudioLayout = () => {
  return (
    <GenerationLayout
      breadcrumb={[{ href: '/audio', title: 'Accoustica' }]}
      generationTopicsSelector={audioGenerationTopicSelectors.generationTopics}
      namespace="audio"
      navKey="audio"
      useStore={useAudioStore}
      viewModeStatusKey="audioTopicViewMode"
    />
  );
};

export default AudioLayout;
