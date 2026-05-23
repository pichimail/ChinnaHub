import { Empty, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  audioGenerationBatchSelectors,
  audioGenerationTopicSelectors,
  useAudioStore,
} from '@/store/audio';

export const GenerationFeed = () => {
  const { t } = useTranslation();
  const activeTopicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore((state) =>
    audioGenerationBatchSelectors.batches(activeTopicId || '')(state),
  );

  if (!activeTopicId || !batches || batches.length === 0) {
    return (
      <Empty
        description={t('generation.noGenerations', { ns: 'audio' })}
        style={{ marginTop: '24px' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--colorText)' }}>
        {t('generation.generationHistory', { ns: 'audio' })}
      </div>
      {batches.flatMap((batch) =>
        batch.generations.map((generation) => (
          <div
            key={generation.id}
            style={{
              backgroundColor: 'var(--colorBgContainer)',
              border: '1px solid var(--colorBorder)',
              borderRadius: '8px',
              padding: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--colorTextSecondary)' }}>
                {new Date(generation.createdAt).toLocaleString()}
              </div>
              <Tag color={generation.status === 'completed' ? 'success' : 'processing'}>
                {generation.status}
              </Tag>
            </div>
            {generation.params && (
              <div
                style={{ fontSize: '12px', color: 'var(--colorTextSecondary)', lineHeight: '1.6' }}
              >
                <div>
                  <strong>Prompt:</strong> {(generation.params as any).prompt}
                </div>
                {(generation.params as any).style && (
                  <div>
                    <strong>Style:</strong> {(generation.params as any).style}
                  </div>
                )}
                {(generation.params as any).title && (
                  <div>
                    <strong>Title:</strong> {(generation.params as any).title}
                  </div>
                )}
              </div>
            )}
          </div>
        )),
      )}
    </div>
  );
};
