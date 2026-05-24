'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { Empty, Spin, Tag } from 'antd';
import { Download, Music2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  audioGenerationBatchSelectors,
  audioGenerationTopicSelectors,
  useAudioStore,
} from '@/store/audio';
import type { AudioGenerationAsset } from '@/types/generation';

interface AudioWorkspaceProps {
  embedInput?: boolean;
}

export const AudioWorkspace = memo<AudioWorkspaceProps>(() => {
  const { t } = useTranslation('audio');
  const activeTopicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore((state) =>
    audioGenerationBatchSelectors.batches(activeTopicId || '')(state),
  );
  const isLoadingTopic = useAudioStore((state) =>
    audioGenerationTopicSelectors.isLoadingGenerationTopic(activeTopicId || '')(state),
  );

  if (!activeTopicId) {
    return (
      <Flexbox align="center" justify="center" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <Empty description={t('generation.noTopic')} />
      </Flexbox>
    );
  }

  if (isLoadingTopic) {
    return (
      <Flexbox align="center" justify="center" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <Spin size="large" />
      </Flexbox>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <Flexbox align="center" justify="center" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <Empty description={t('generation.noGenerations')} />
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={16} paddingBlock={24} width="100%">
      {batches.map((batch) => (
        <Flexbox
          gap={12}
          key={batch.id}
          padding={16}
          style={{
            background: 'var(--colorBgContainer)',
            border: '1px solid var(--colorBorderSecondary)',
            borderRadius: 16,
          }}
        >
          <Flexbox horizontal align="center" gap={12} justify="space-between">
            <Flexbox gap={4} style={{ minWidth: 0 }}>
              <Text ellipsis weight={600}>
                {(batch.config as { style?: string } | undefined)?.style ||
                  batch.prompt ||
                  'Accoustica'}
              </Text>
              <Text ellipsis fontSize={12} type="secondary">
                {batch.provider === 'openrouter' ? 'Accoustica Lyria' : 'Accoustica Classic'} ·{' '}
                {new Date(batch.createdAt).toLocaleString()}
              </Text>
            </Flexbox>
            <Tag>{batch.model}</Tag>
          </Flexbox>

          <Flexbox gap={12}>
            {batch.generations.map((generation) => {
              const asset = generation.asset as AudioGenerationAsset | null | undefined;
              const audioUrl = asset?.url;
              const status = generation.task.status;

              return (
                <Flexbox
                  gap={10}
                  key={generation.id}
                  padding={14}
                  style={{
                    background: 'var(--colorFillQuaternary)',
                    borderRadius: 14,
                  }}
                >
                  <Flexbox horizontal align="center" gap={12} justify="space-between">
                    <Flexbox horizontal align="center" gap={8}>
                      <Music2 size={18} />
                      <Text weight={500}>Accoustica Track</Text>
                    </Flexbox>
                    <Tag
                      color={
                        status === 'success'
                          ? 'success'
                          : status === 'error'
                            ? 'error'
                            : 'processing'
                      }
                    >
                      {status}
                    </Tag>
                  </Flexbox>
                  {audioUrl ? (
                    <Flexbox horizontal align="center" gap={8}>
                      <audio controls src={audioUrl} style={{ flex: 1, width: '100%' }} />
                      <ActionIcon
                        icon={Download}
                        title={t('generation.download', { defaultValue: 'Download' })}
                        onClick={() => window.open(audioUrl, '_blank', 'noopener,noreferrer')}
                      />
                    </Flexbox>
                  ) : (
                    <Text fontSize={13} type="secondary">
                      {status === 'error'
                        ? t('generation.failed')
                        : t('generation.processing', { defaultValue: 'Audio is being generated.' })}
                    </Text>
                  )}
                </Flexbox>
              );
            })}
          </Flexbox>
        </Flexbox>
      ))}
    </Flexbox>
  );
});

AudioWorkspace.displayName = 'AudioWorkspace';
