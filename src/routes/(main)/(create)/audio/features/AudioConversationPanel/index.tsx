'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { Bot, UserRound } from 'lucide-react';
import { memo, useMemo } from 'react';

import { audioConversationSelectors, useAudioStore } from '@/store/audio';

const quickActions = [
  'Extend this song',
  'Make a remix version',
  'Add stronger vocals',
  'Create an instrumental version',
  'Split vocals and music',
  'Boost the music style',
  'Regenerate cover art',
  'Create a music video',
  'Replace the chorus section',
];

const starterMessages = [
  {
    content:
      'Tell me the song you want. I can turn a simple idea into two Accoustica tracks, then help you revise the result through follow-up requests.',
    createdAt: 0,
    id: 'audio-starter-assistant',
    role: 'assistant' as const,
  },
];

export const AudioConversationPanel = memo(() => {
  const messages = useAudioStore(audioConversationSelectors.messages);
  const lastTrack = useAudioStore(audioConversationSelectors.lastTrack);
  const { appendAudioMessage, setAudioPrompt } = useAudioStore();

  const visibleMessages = useMemo(() => {
    return messages.length > 0 ? messages : starterMessages;
  }, [messages]);

  const handleQuickAction = (action: string) => {
    const trackContext = lastTrack
      ? ` for "${lastTrack.title || 'the last generated track'}"`
      : '';
    const nextPrompt = `${action}${trackContext}. Keep the best parts and improve the result.`;

    setAudioPrompt(nextPrompt);
    appendAudioMessage({
      content: nextPrompt,
      intent: 'followUp',
      role: 'user',
      trackContext: lastTrack,
    });
    appendAudioMessage({
      content:
        'I added that follow-up into the composer. Press generate and I will use the previous track context for the next version.',
      intent: 'followUp',
      role: 'assistant',
      trackContext: lastTrack,
    });
  };

  return (
    <Block gap={14} padding={16} variant="borderless">
      <Flexbox gap={4}>
        <Text weight={700}>Accoustica chat</Text>
        <Text fontSize={12} type="secondary">
          Persistent music conversation, generation guidance, and context-aware follow-up chaining.
        </Text>
      </Flexbox>

      <Flexbox gap={10} style={{ maxHeight: 340, overflow: 'auto', paddingInlineEnd: 4 }}>
        {visibleMessages.map((item) => {
          const isUser = item.role === 'user';

          return (
            <Flexbox
              horizontal
              align="flex-start"
              gap={8}
              justify={isUser ? 'flex-end' : 'flex-start'}
              key={item.id}
            >
              {!isUser && <Bot size={18} />}
              <div
                style={{
                  background: isUser
                    ? 'linear-gradient(135deg, rgb(110 139 255 / 28%), rgb(71 217 198 / 22%))'
                    : 'rgb(255 255 255 / 6%)',
                  border: '1px solid rgb(255 255 255 / 9%)',
                  borderRadius: 18,
                  maxWidth: 'min(680px, 86%)',
                  padding: '10px 12px',
                }}
              >
                <Text style={{ whiteSpace: 'pre-wrap' }}>{item.content}</Text>
              </div>
              {isUser && <UserRound size={18} />}
            </Flexbox>
          );
        })}
      </Flexbox>

      <Flexbox horizontal align="center" gap={8} style={{ flexWrap: 'wrap' }}>
        {quickActions.map((action) => (
          <Button key={action} shape="round" size="small" onClick={() => handleQuickAction(action)}>
            {action}
          </Button>
        ))}
      </Flexbox>
    </Block>
  );
});

AudioConversationPanel.displayName = 'AudioConversationPanel';

export default AudioConversationPanel;
