'use client';

import { BUILTIN_AGENT_SLUGS } from '@lobechat/builtin-agents';
import { type ReactNode } from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { ConversationProvider } from '@/features/Conversation';
import { useOperationState } from '@/hooks/useOperationState';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import type { MessageMapKeyInput } from '@/store/chat/utils/messageMapKey';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';

interface AdminAssistantProviderProps {
  children: ReactNode;
}

const AdminAssistantProvider = memo<AdminAssistantProviderProps>(({ children }) => {
  const useInitBuiltinAgent = useAgentStore((s) => s.useInitBuiltinAgent);
  const adminAssistantId = useAgentStore(builtinAgentSelectors.adminAssistantId);
  const activeTopicId = useChatStore((s) => s.activeTopicId);
  const setActiveAgentId = useAgentStore((s) => s.setActiveAgentId);
  const syncedAgentIdRef = useRef<string | undefined>(undefined);

  useInitBuiltinAgent(BUILTIN_AGENT_SLUGS.adminAssistant);

  useEffect(() => {
    if (!adminAssistantId) return;

    if (useAgentStore.getState().activeAgentId !== adminAssistantId) {
      setActiveAgentId(adminAssistantId);
    }

    const chatState = useChatStore.getState();
    const shouldResetTopic =
      chatState.activeAgentId !== adminAssistantId || !!chatState.activeTopicId;

    if (chatState.activeAgentId !== adminAssistantId) {
      useChatStore.setState(
        { activeAgentId: adminAssistantId },
        false,
        'AdminAssistant/AdminAssistantProvider/syncActiveAgentId',
      );
    }

    if (syncedAgentIdRef.current === adminAssistantId) return;
    syncedAgentIdRef.current = adminAssistantId;

    if (shouldResetTopic) {
      void chatState.switchTopic(null, { scope: 'page', skipRefreshMessage: true });
    }
  }, [adminAssistantId, setActiveAgentId]);

  const context = useMemo<MessageMapKeyInput>(
    () => ({
      agentId: adminAssistantId || 'admin-assistant',
      scope: 'page',
      topicId: activeTopicId,
    }),
    [adminAssistantId, activeTopicId],
  );

  const chatKey = useMemo(() => messageMapKey(context), [context]);
  const replaceMessages = useChatStore((s) => s.replaceMessages);
  const messages = useChatStore((s) => (chatKey ? s.dbMessagesMap[chatKey] : undefined));
  const operationState = useOperationState(context);

  if (!adminAssistantId) return <Loading debugId="AdminAssistantProvider" />;

  return (
    <ConversationProvider
      context={context}
      hasInitMessages={!!messages}
      messages={messages}
      operationState={operationState}
      onMessagesChange={(msgs, ctx) => {
        replaceMessages(msgs, { context: ctx });
      }}
    >
      {children}
    </ConversationProvider>
  );
});

AdminAssistantProvider.displayName = 'AdminAssistantProvider';

export default AdminAssistantProvider;
