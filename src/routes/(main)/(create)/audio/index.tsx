'use client';

import { memo } from 'react';

import CreateGenerationPage from '@/routes/(main)/(create)/features/CreateGenerationPage';

import AudioWorkspace from './features/SimpleAudioWorkspace';
import PromptInput from './features/PromptInput/Lean';

const DesktopAudioPage = memo(() => (
  <CreateGenerationPage PromptInput={PromptInput} Workspace={AudioWorkspace} />
));

DesktopAudioPage.displayName = 'DesktopAudioPage';

export default DesktopAudioPage;
