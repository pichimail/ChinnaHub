'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import CreateGenerationPage from '@/routes/(main)/(create)/features/CreateGenerationPage';

import { AudioConversationPanel } from './features/AudioConversationPanel';
import { AudioConversationReadyWatcher } from './features/AudioConversationPanel/ReadyWatcher';
import ImageStyleAudioWorkspace from './features/ImageStyleAudioWorkspace';
import PromptInput from './features/PromptInput/Lean';

const ConversationalAudioWorkspace = memo(() => (
  <Flexbox gap={16} width="100%">
    <AudioConversationReadyWatcher />
    <AudioConversationPanel />
    <ImageStyleAudioWorkspace />
  </Flexbox>
));

ConversationalAudioWorkspace.displayName = 'ConversationalAudioWorkspace';

const DesktopAudioPage = memo(() => (
  <CreateGenerationPage PromptInput={PromptInput} Workspace={ConversationalAudioWorkspace} />
));

DesktopAudioPage.displayName = 'DesktopAudioPage';

export default DesktopAudioPage;
