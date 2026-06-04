'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { type ActionKeys } from '@/features/ChatInput';
import { ChatInput, ChatList } from '@/features/Conversation';

import AdminAssistantWelcome from './AdminAssistantWelcome';

const leftActions: ActionKeys[] = ['agentMode', 'search', 'tools', 'fileUpload', 'model', 'params'];
const rightActions: ActionKeys[] = ['stt'];

const AdminAssistantConversation = memo(() => {
  return (
    <Flexbox flex={1} height={'100%'} style={{ minHeight: 0, overflow: 'hidden' }}>
      <Flexbox flex={1} style={{ minHeight: 0, overflow: 'hidden' }}>
        <ChatList welcome={<AdminAssistantWelcome />} />
      </Flexbox>
      <ChatInput leftActions={leftActions} rightActions={rightActions} showRuntimeConfig />
    </Flexbox>
  );
});

AdminAssistantConversation.displayName = 'AdminAssistantConversation';

export default AdminAssistantConversation;
