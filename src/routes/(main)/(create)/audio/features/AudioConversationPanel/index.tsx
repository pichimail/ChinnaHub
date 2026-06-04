'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { Collapse, Progress, Tag } from 'antd';
import { Bot, Lightbulb, UserRound } from 'lucide-react';
import { memo, useEffect, useMemo } from 'react';

import {
  audioConversationSelectors,
  audioGenerationConfigSelectors,
  createAudioSelectors,
  useAudioStore,
} from '@/store/audio';

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

const promptSuggestions = [
  'Create a cinematic Telugu-English love song with warm male vocals and emotional strings',
  'Generate a high-energy festival dance track with Indian percussion and a huge chorus',
  'Write romantic lyrics with a memorable hook, soft piano, and modern pop drums',
  'Make this track cleaner by avoiding muddy mix, weak drums, and harsh vocals',
  'Create a premium R&B song with smooth vocals, deep bass, and late-night atmosphere',
  'Turn the last track into a remix with stronger drop, brighter synths, and tighter rhythm',
  'Replace the chorus with a more addictive hook and keep the original mood',
  'Boost the style influence while keeping vocals natural and radio-ready',
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

const getSearchTerms = (query?: string) =>
  Array.from(
    new Set(
      (query || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2)
        .slice(0, 8),
    ),
  );

const renderHighlightedSuggestion = (suggestion: string, terms: string[]) => {
  if (terms.length === 0) return suggestion;

  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const parts = suggestion.split(pattern);

  return parts.map((part, index) => {
    const isHit = terms.includes(part.toLowerCase());

    return isHit ? (
      <mark
        key={`${part}-${index}`}
        style={{
          background: 'rgb(110 139 255 / 34%)',
          borderRadius: 6,
          color: 'inherit',
          paddingInline: 3,
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
};

export const AudioConversationPanel = memo(() => {
  const messages = useAudioStore(audioConversationSelectors.messages);
  const lastTrack = useAudioStore(audioConversationSelectors.lastTrack);
  const parameters = useAudioStore(audioGenerationConfigSelectors.parameters);
  const isCreating = useAudioStore(createAudioSelectors.isCreating);
  const { appendAudioMessage, hydrateAudioConversation, setAudioNegativeTags, setAudioPrompt, setAudioStyle } =
    useAudioStore();

  useEffect(() => {
    hydrateAudioConversation();
  }, [hydrateAudioConversation]);

  const visibleMessages = useMemo(() => {
    return messages.length > 0 ? messages : starterMessages;
  }, [messages]);

  const searchTerms = useMemo(() => getSearchTerms(parameters.prompt), [parameters.prompt]);

  const filteredSuggestions = useMemo(() => {
    if (searchTerms.length === 0) return promptSuggestions.slice(0, 5);

    const ranked = promptSuggestions
      .map((suggestion) => ({
        score: searchTerms.filter((term) => suggestion.toLowerCase().includes(term)).length,
        suggestion,
      }))
      .sort((a, b) => b.score - a.score);

    return ranked.filter((item) => item.score > 0).map((item) => item.suggestion).slice(0, 5);
  }, [searchTerms]);

  const progress = isCreating ? 36 : lastTrack ? 100 : messages.length > 0 ? 18 : 0;

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

  const handleSuggestion = (suggestion: string) => {
    setAudioPrompt(suggestion);
    if (suggestion.toLowerCase().includes('avoid')) {
      setAudioNegativeTags('muddy mix, weak drums, harsh vocals, flat hook');
    }
    if (suggestion.toLowerCase().includes('r&b')) setAudioStyle('r&b romance, smooth vocals');
    if (suggestion.toLowerCase().includes('festival')) setAudioStyle('festival dance, Indian percussion');
  };

  return (
    <Block gap={14} padding={16} variant="borderless">
      <Flexbox gap={4}>
        <Text weight={700}>Accoustica chat</Text>
        <Text fontSize={12} type="secondary">
          Persistent music conversation, creation status, highlighted suggestions, and context-aware follow-up chaining.
        </Text>
      </Flexbox>

      <Collapse
        bordered={false}
        defaultActiveKey={['steps']}
        items={[
          {
            children: (
              <Flexbox gap={10}>
                <Progress percent={progress} showInfo={false} size="small" />
                <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
                  <Tag color={parameters.prompt ? 'success' : 'default'}>Understand request</Tag>
                  <Tag color={parameters.style ? 'success' : 'processing'}>Shape style</Tag>
                  <Tag color={parameters.negativeTags ? 'success' : 'processing'}>Set negative tags</Tag>
                  <Tag color={isCreating ? 'processing' : lastTrack ? 'success' : 'default'}>
                    Compose & poll
                  </Tag>
                  <Tag color={lastTrack ? 'success' : 'default'}>Ready to revise</Tag>
                </Flexbox>
                <Text fontSize={12} type="secondary">
                  These are user-visible creation steps. Internal private reasoning is not shown.
                </Text>
              </Flexbox>
            ),
            key: 'steps',
            label: 'Creation steps',
          },
          {
            children: (
              <Flexbox gap={8}>
                <Flexbox horizontal align="center" gap={6}>
                  <Lightbulb size={15} />
                  <Text fontSize={12} type="secondary">
                    Suggestions highlight words related to your current prompt.
                  </Text>
                </Flexbox>
                <Flexbox gap={8}>
                  {filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'start',
                        border: '1px solid rgb(255 255 255 / 9%)',
                        borderRadius: 14,
                        padding: '9px 11px',
                        color: 'inherit',
                        background: 'rgb(255 255 255 / 5%)',
                      }}
                      type="button"
                      onClick={() => handleSuggestion(suggestion)}
                    >
                      {renderHighlightedSuggestion(suggestion, searchTerms)}
                    </button>
                  ))}
                </Flexbox>
              </Flexbox>
            ),
            key: 'suggestions',
            label: 'Highlighted prompt suggestions',
          },
        ]}
      />

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
