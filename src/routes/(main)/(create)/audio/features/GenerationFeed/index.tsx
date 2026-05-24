'use client';

import { Empty, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  audioGenerationBatchSelectors,
  audioGenerationTopicSelectors,
  useAudioStore,
} from '@/store/audio';

export const GenerationFeed = () => {
  const { t } = useTranslation('audio');
  const activeTopicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore((state) =>
    audioGenerationBatchSelectors.batches(activeTopicId || '')(state),
  );

  if (!activeTopicId || !batches || batches.length === 0) {
    return <Empty description={t('generation.noGenerations')} style={{ marginTop: 24 }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: 'var(--colorText)', fontSize: 14, fontWeight: 600 }}>
        {t('generation.generationHistory')}
      </div>
      {batches.flatMap((batch) =>
        batch.generations.map((generation) => (
          <div
            key={generation.id}
            style={{
              backgroundColor: 'var(--colorBgContainer)',
              border: '1px solid var(--colorBorder)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <div
              style={{
                alignItems: 'center',
                display: 'flex',
                gap: 8,
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ color: 'var(--colorTextSecondary)', fontSize: 12 }}>
                {new Date(generation.createdAt).toLocaleString()}
              </div>
              <Tag color={generation.task.status === 'success' ? 'success' : 'processing'}>
                {generation.task.status}
              </Tag>
            </div>
            <div style={{ color: 'var(--colorTextSecondary)', fontSize: 12, lineHeight: 1.6 }}>
              <div>
                <strong>Prompt:</strong> {batch.prompt}
              </div>
              {(batch.config as { style?: string } | undefined)?.style && (
                <div>
                  <strong>Style:</strong> {(batch.config as { style?: string }).style}
                </div>
              )}
            </div>
          </div>
        )),
      )}
    </div>
  );
};
