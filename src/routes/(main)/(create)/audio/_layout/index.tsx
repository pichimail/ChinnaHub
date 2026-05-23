'use client';

import { useTranslation } from 'react-i18next';

import GenerationLayout from '@/routes/(main)/(create)/features/GenerationLayout';
import { useAudioStore } from '@/store/audio';
import { generationTopicSelectors } from '@/store/audio/slices/generationTopic/selectors';

const AudioLayout = () => {
  const { t } = useTranslation(['common']);

  return (
    <GenerationLayout
      breadcrumb={[{ href: '/audio', title: t('tab.audio') }]}
      generationTopicsSelector={generationTopicSelectors.generationTopics}
      namespace="audio"
      navKey="audio"
      useStore={useAudioStore}
      viewModeStatusKey="audioTopicViewMode"
    />
  );
};

export default AudioLayout;
