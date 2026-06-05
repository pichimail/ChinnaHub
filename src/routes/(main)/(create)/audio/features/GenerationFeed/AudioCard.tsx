'use client';

import { Flexbox, Tag, Text } from '@lobehub/ui';
import { Progress } from 'antd';
import { createStaticStyles } from 'antd-style';
import { AlertCircleIcon, Music2Icon } from 'lucide-react';
import { memo } from 'react';

import { type AudioTrack } from '@/store/audio/slices/createAudio/initialState';

import MusicPlayer from './MusicPlayer';

const useStyles = createStaticStyles(({ css, token }) => ({
  card: css`
    width: 100%;
  `,
  prompt: css`
    font-size: 13px;
    color: ${token.colorTextSecondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  `,
  loadingCard: css`
    background: ${token.colorBgContainer};
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 16px;
    padding: 16px;
  `,
  loadingWave: css`
    display: flex;
    align-items: center;
    gap: 3px;
    height: 120px;
    padding: 4px 0;
    justify-content: center;
  `,
  wavebar: css`
    width: 4px;
    border-radius: 2px;
    background: ${token.colorPrimary};
    opacity: 0.6;
    animation: wavePulse 1.2s ease-in-out infinite;

    @keyframes wavePulse {
      0%, 100% { height: 8px; opacity: 0.3; }
      50% { height: 40px; opacity: 0.9; }
    }
  `,
}));

interface AudioCardProps {
  track: AudioTrack;
}

const STATUS_LABELS: Record<string, { color: string; label: string }> = {
  pending: { color: 'blue', label: 'Queued' },
  processing: { color: 'orange', label: 'Generating' },
  completed: { color: 'green', label: 'Ready' },
  failed: { color: 'red', label: 'Failed' },
};

const AudioCard = memo<AudioCardProps>(({ track }) => {
  const { styles } = useStyles();
  const statusInfo = STATUS_LABELS[track.status] ?? STATUS_LABELS.pending;
  const showPlayer = track.status === 'completed' && !!track.audioUrl;

  if (showPlayer) {
    return (
      <div className={styles.card}>
        <MusicPlayer audioUrl={track.audioUrl!} imageUrl={track.imageUrl} title={track.title || undefined} />
      </div>
    );
  }

  return (
    <div className={styles.loadingCard}>
      <Flexbox align="center" gap={10} horizontal style={{ marginBottom: 12 }}>
        <Music2Icon size={16} />
        <div className={styles.prompt}>{track.title || track.prompt}</div>
        <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
      </Flexbox>

      {track.status === 'failed' ? (
        <Flexbox align="center" gap={8} horizontal>
          <AlertCircleIcon color="var(--ant-color-error)" size={16} />
          <Text type="danger" style={{ fontSize: 13 }}>
            Generation failed. Please try again.
          </Text>
        </Flexbox>
      ) : (
        <>
          <div className={styles.loadingWave}>
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className={styles.wavebar}
                style={{
                  animationDelay: `${(i % 4) * 0.15}s`,
                  height: `${8 + ((i * 7) % 28)}px`,
                }}
              />
            ))}
          </div>

          <Progress percent={track.progress} showInfo={false} size="small" status="active" />

          <Text style={{ fontSize: 12, marginTop: 6 }} type="secondary">
            {track.progress < 25
              ? 'Starting up...'
              : track.progress < 60
                ? 'Composing your track...'
                : 'Finalizing audio...'}{' '}
            Controls appear after the track is ready.
          </Text>
        </>
      )}
    </div>
  );
});

AudioCard.displayName = 'AudioCard';

export default AudioCard;
