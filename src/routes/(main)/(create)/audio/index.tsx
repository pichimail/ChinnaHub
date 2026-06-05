'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import CreateGenerationPage from '@/routes/(main)/(create)/features/CreateGenerationPage';

import AudioBatchLoader from './features/AudioBatchLoader';
import AlbumWorkspace from './features/AlbumWorkspace';
import PromptInput from './features/PromptInput/Lean';

const AudioWorkspace = memo(() => (
  <Flexbox gap={16} width="100%">
    <AudioBatchLoader />
    <AlbumWorkspace />
  </Flexbox>
));

AudioWorkspace.displayName = 'AudioWorkspace';

const DesktopAudioPage = memo(() => (
  <CreateGenerationPage PromptInput={PromptInput} Workspace={AudioWorkspace} />
));

DesktopAudioPage.displayName = 'DesktopAudioPage';

export default DesktopAudioPage;
