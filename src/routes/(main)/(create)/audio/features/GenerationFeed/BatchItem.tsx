'use client';

import { AudioPlayer, AudioVisualizer, useAudioPlayer } from '@lobehub/tts/react';
import { ActionIconGroup, Block, Flexbox, Markdown, Text } from '@lobehub/ui';
import { App } from 'antd';
import dayjs from 'dayjs';
import { CopyIcon, Music2Icon, Trash2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useAudioStore } from '@/store/audio';
import { AsyncTaskStatus } from '@/types/asyncTask';
import type { GenerationBatch } from '@/types/generation';

interface AudioGenerationBatchItemProps {
  batch: GenerationBatch;
}

export const AudioGenerationBatchItem = memo<AudioGenerationBatchItemProps>(({ batch }) => {
  const { message } = App.useApp();
  const { t } = useTranslation('audio');
  const useCheckGenerationStatus = useAudioStore((s) => s.useCheckGenerationStatus);
  const removeGenerationBatch = useAudioStore((s) => s.removeGenerationBatch);
  const activeTopicId = useAudioStore((s) => s.activeGenerationTopicId);

  const generation = batch.generations[0];
  const { isLoading, ref, ...audio } = useAudioPlayer({ src: generation?.asset?.url || '' });

  useCheckGenerationStatus(
    generation?.id ?? '',
    generation?.task.id ?? '',
    activeTopicId!,
    !!generation &&
      generation.task.status !== AsyncTaskStatus.Success &&
      generation.task.status !== AsyncTaskStatus.Error,
  );

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(batch.prompt);
      message.success(t('generation.actions.promptCopied'));
    } catch {
      message.error(t('generation.actions.promptCopyFailed'));
    }
  }, [batch.prompt, message, t]);

  const handleDeleteBatch = useCallback(async () => {
    if (!activeTopicId) return;
    await removeGenerationBatch(batch.id, activeTopicId);
  }, [activeTopicId, batch.id, removeGenerationBatch]);

  return (
    <Block gap={8} variant={'borderless'}>
      <Markdown variant={'chat'}>{batch.prompt}</Markdown>

      {generation?.asset?.url ? (
        <Flexbox gap={8}>
          <AudioPlayer
            allowPause
            audio={audio}
            isLoading={isLoading}
            showDonload={false}
            timeRender={'text'}
            title={t('generation.player.title')}
          />
          <AudioVisualizer audioRef={ref} color={'#52c41a'} />
        </Flexbox>
      ) : (
        <Flexbox horizontal align={'center'} gap={6}>
          <Music2Icon size={16} />
          <Text type={'secondary'}>{t('generation.status.generating')}</Text>
        </Flexbox>
      )}

      <Text type={'secondary'}>{dayjs(batch.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>

      <ActionIconGroup
        items={[
          {
            icon: CopyIcon,
            key: 'copyPrompt',
            label: t('generation.actions.copyPrompt'),
            onClick: handleCopyPrompt,
          },
          {
            danger: true,
            icon: Trash2,
            key: 'deleteBatch',
            label: t('generation.actions.deleteBatch'),
            onClick: handleDeleteBatch,
          },
        ]}
      />
    </Block>
  );
});

AudioGenerationBatchItem.displayName = 'AudioGenerationBatchItem';
