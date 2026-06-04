'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import CreateGenerationPage from '@/routes/(main)/(create)/features/CreateGenerationPage';

import { AudioConversationPanel } from './features/AudioConversationPanel';
import { AudioConversationReadyWatcher } from './features/AudioConversationPanel/ReadyWatcher';
import { AudioWorkspace } from './features/AudioWorkspace';
import PromptInput from './features/PromptInput';

const ConversationalAudioWorkspace = memo(() => (
  <Flexbox gap={16} width="100%">
    <AudioConversationReadyWatcher />
    <AudioConversationPanel />
    <AudioWorkspace />
  </Flexbox>
));

ConversationalAudioWorkspace.displayName = 'ConversationalAudioWorkspace';

const DesktopAudioPage = memo(() => (
  <CreateGenerationPage PromptInput={PromptInput} Workspace={ConversationalAudioWorkspace} />
));

DesktopAudioPage.displayName = 'DesktopAudioPage';

export default DesktopAudioPage;
