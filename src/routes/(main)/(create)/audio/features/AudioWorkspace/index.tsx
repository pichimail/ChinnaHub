import { Empty, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  audioGenerationBatchSelectors,
  audioGenerationTopicSelectors,
  useAudioStore,
} from '@/store/audio';

export const AudioWorkspace = () => {
  const { t } = useTranslation();
  const activeTopicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore((state) =>
    audioGenerationBatchSelectors.batches(activeTopicId || '')(state),
  );
  const isLoadingTopic = useAudioStore((state) =>
    audioGenerationTopicSelectors.isLoadingGenerationTopic(activeTopicId || '')(state),
  );

  if (!activeTopicId) {
    return (
      <Empty description={t('generation.noTopic', { ns: 'audio' })} style={{ marginTop: '48px' }} />
    );
  }

  if (isLoadingTopic) {
    return <Spin size="large" style={{ marginTop: '48px' }} />;
  }

  if (!batches || batches.length === 0) {
    return (
      <Empty
        description={t('generation.noGenerations', { ns: 'audio' })}
        style={{ marginTop: '48px' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {batches.map((batch) => (
        <div
          key={batch.id}
          style={{
            border: '1px solid var(--colorBorder)',
            borderRadius: '8px',
            padding: '12px',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--colorTextSecondary)' }}>
            {new Date(batch.createdAt).toLocaleString()}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            {batch.generations.map((generation) => (
              <div
                key={generation.id}
                style={{
                  backgroundColor: 'var(--colorBgContainer)',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--colorTextSecondary)',
                    marginBottom: '8px',
                  }}
                >
                  {generation.status}
                </div>
                {generation.asset?.audioUrl && (
                  <audio
                    controls
                    src={generation.asset.audioUrl as string}
                    style={{ width: '100%' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
