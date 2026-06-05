'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import {
  DownloadIcon,
  MoreVerticalIcon,
  PauseIcon,
  PlayIcon,
  Share2Icon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

const useStyles = createStaticStyles(({ css, token }) => ({
  album: css`
    cursor: pointer;
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    width: 100%;
    border-radius: 16px;
    background: ${token.colorFillSecondary};
    border: 1px solid ${token.colorBorderSecondary};

    &:hover .audio-controls {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  `,
  albumImage: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  `,
  fallback: css`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    color: ${token.colorTextQuaternary};
    background: ${token.colorFillSecondary};
  `,
  controls: css`
    pointer-events: none;
    position: absolute;
    inset-inline: 10px;
    top: 10px;
    z-index: 2;
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 0.16s ${token.motionEaseOut}, transform 0.16s ${token.motionEaseOut};
  `,
  playButton: css`
    backdrop-filter: blur(14px);
    background: ${token.colorBgElevated}cc;
  `,
  footer: css`
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    z-index: 1;
    padding: 44px 12px 10px;
    background: linear-gradient(180deg, transparent 0%, ${token.colorBgContainer}ee 100%);
  `,
  progressTrack: css`
    cursor: pointer;
    height: 4px;
    border-radius: 999px;
    background: ${token.colorFillTertiary};
    overflow: hidden;
  `,
  progressFill: css`
    height: 100%;
    border-radius: inherit;
    background: ${token.colorPrimary};
  `,
  time: css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
    font-variant-numeric: tabular-nums;
  `,
  title: css`
    font-size: 13px;
    font-weight: 600;
    color: ${token.colorText};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
}));

interface MusicPlayerProps {
  audioUrl: string;
  title?: string;
  imageUrl?: string;
  onDownload?: () => void;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const MusicPlayer = memo<MusicPlayerProps>(({ audioUrl, title, imageUrl, onDownload }) => {
  const { styles } = useStyles();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      await audio.play().catch(() => null);
    }
  }, [playing]);

  const toggleMute = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const handleProgressClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      audio.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
    },
    [duration],
  );

  const handleDownload = useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      if (onDownload) {
        onDownload();
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = audioUrl;
      anchor.download = `${title || 'accoustica-track'}.mp3`;
      anchor.click();
    },
    [audioUrl, title, onDownload],
  );

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={styles.album} role="button" tabIndex={0} onClick={togglePlay}>
      <audio ref={audioRef} preload="metadata" src={audioUrl} />

      {imageUrl ? (
        <img alt={title || 'Accoustica album art'} className={styles.albumImage} src={imageUrl} />
      ) : (
        <div className={styles.fallback}>♪</div>
      )}

      <Flexbox className={`${styles.controls} audio-controls`} horizontal justify="space-between">
        <ActionIcon
          active={playing}
          className={styles.playButton}
          icon={playing ? PauseIcon : PlayIcon}
          size={{ blockSize: 44, fontSize: 24 }}
          onClick={(event) => {
            event.stopPropagation();
            void togglePlay();
          }}
        />
        <Flexbox horizontal gap={6}>
          <ActionIcon
            className={styles.playButton}
            icon={muted ? VolumeXIcon : Volume2Icon}
            size={{ blockSize: 34, fontSize: 16 }}
            onClick={toggleMute}
          />
          <ActionIcon
            className={styles.playButton}
            icon={DownloadIcon}
            size={{ blockSize: 34, fontSize: 16 }}
            onClick={handleDownload}
          />
          <ActionIcon
            className={styles.playButton}
            icon={Share2Icon}
            size={{ blockSize: 34, fontSize: 16 }}
            onClick={(event) => event.stopPropagation()}
          />
          <ActionIcon
            className={styles.playButton}
            icon={MoreVerticalIcon}
            size={{ blockSize: 34, fontSize: 16 }}
            onClick={(event) => event.stopPropagation()}
          />
        </Flexbox>
      </Flexbox>

      <Flexbox className={styles.footer} gap={8}>
        {title && <Text className={styles.title}>{title}</Text>}
        <div className={styles.progressTrack} onClick={handleProgressClick}>
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <Flexbox horizontal justify="space-between">
          <span className={styles.time}>{formatTime(currentTime)}</span>
          <span className={styles.time}>{duration > 0 ? formatTime(duration) : '0:00'}</span>
        </Flexbox>
      </Flexbox>
    </div>
  );
});

MusicPlayer.displayName = 'MusicPlayer';

export default MusicPlayer;
