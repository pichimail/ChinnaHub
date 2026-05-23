'use client';

import GenerationWorkspace from '@/routes/(main)/(create)/features/GenerationWorkspace';
import { useAudioStore } from '@/store/audio';
import { audioGenerationTopicSelectors, generationBatchSelectors } from '@/store/audio/selectors';

import GenerationFeed from '../GenerationFeed';
import PromptInput from '../PromptInput';
import SkeletonList from './SkeletonList';

interface AudioWorkspaceProps {
  embedInput?: boolean;
}

const AudioWorkspace = ({ embedInput = true }: AudioWorkspaceProps) => (
  <GenerationWorkspace
    GenerationFeed={GenerationFeed}
    PromptInput={PromptInput}
    SkeletonList={SkeletonList}
    embedInput={embedInput}
    useStore={useAudioStore}
    selectors={{
      activeGenerationTopicId: audioGenerationTopicSelectors.activeGenerationTopicId,
      currentGenerationBatches: generationBatchSelectors.currentGenerationBatches,
      isCurrentGenerationTopicLoaded: generationBatchSelectors.isCurrentGenerationTopicLoaded,
    }}
  />
);

export default AudioWorkspace;
