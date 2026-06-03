'use client';

import { AsyncTaskStatus } from '@lobechat/types';
import { Block, Button, DropdownMenu, Flexbox, Icon, Markdown, Text } from '@lobehub/ui';
import { App, Empty, Modal, Slider, Spin, Tag } from 'antd';
import { type ItemType } from 'antd/es/menu/interface';
import { createStaticStyles } from 'antd-style';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Expand,
  MessageCircleMore,
  MicVocal,
  MoreVertical,
  Music2,
  Pause,
  Play,
  RefreshCcw,
  Share2,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Visualizer from '@/features/AudioPlayer/Visualizer';
import { audioService } from '@/services/audio';
import {
  audioGenerationBatchSelectors,
  audioGenerationTopicSelectors,
  useAudioStore,
} from '@/store/audio';
import {
  type AudioGenerationAsset,
  type Generation,
  type GenerationBatch,
} from '@/types/generation';
import { downloadFile } from '@/utils/client/downloadFile';

const styles = createStaticStyles(({ css, cssVar }) => ({
  artwork: css`
    position: relative;

    overflow: hidden;
    flex: 0 0 132px;

    aspect-ratio: 1;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 22px;

    background:
      radial-gradient(circle at 25% 25%, rgb(255 255 255 / 34%), transparent 28%),
      linear-gradient(
        135deg,
        rgb(92 132 255 / 76%),
        rgb(146 68 255 / 66%) 50%,
        rgb(36 196 163 / 72%)
      );
    box-shadow: 0 12px 40px rgb(0 0 0 / 16%);
  `,
  artworkReady: css`
    border-color: rgb(87 217 197 / 72%);
    box-shadow:
      0 0 0 1px rgb(87 217 197 / 18%),
      0 16px 52px rgb(71 217 198 / 18%);
  `,
  artworkButton: css`
    cursor: pointer;

    position: relative;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;

    color: white;

    background: transparent;

    transition:
      transform 0.22s ${cssVar.motionEaseOut},
      box-shadow 0.22s ${cssVar.motionEaseOut};

    &:hover {
      transform: translateY(-1px);
    }
  `,
  artworkImage: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,
  artworkPlaceholder: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: center;

    width: 100%;
    height: 100%;
    padding: 16px;
  `,
  artworkOverlay: css`
    position: absolute;
    inset-block: auto 12px;
    inset-inline: auto 12px;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 42px;
    height: 42px;
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: 999px;

    color: white;

    background: rgb(8 8 8 / 46%);
    backdrop-filter: blur(16px);
  `,
  artworkOverlayReady: css`
    border-color: rgb(255 255 255 / 34%);
    background: linear-gradient(135deg, rgb(87 217 197 / 82%), rgb(110 139 255 / 82%));
    box-shadow: 0 0 26px rgb(87 217 197 / 38%);
  `,
  audioCard: css`
    position: relative;

    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;

    background: linear-gradient(180deg, rgb(255 255 255 / 5%), rgb(255 255 255 / 2%));

    transition:
      transform 0.22s ${cssVar.motionEaseOut},
      box-shadow 0.22s ${cssVar.motionEaseOut},
      border-color 0.22s ${cssVar.motionEaseOut};
  `,
  audioCardActive: css`
    box-shadow:
      0 0 0 1px rgb(106 133 255 / 18%),
      0 18px 56px rgb(0 0 0 / 20%);
  `,
  batchCard: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;
    background:
      radial-gradient(circle at 10% 0%, rgb(100 160 255 / 8%), transparent 30%),
      ${cssVar.colorBgContainer};
  `,
  expandedBody: css`
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition:
      grid-template-rows 0.28s ${cssVar.motionEaseInOut},
      opacity 0.2s ${cssVar.motionEaseInOut};
  `,
  expandedBodyInner: css`
    overflow: hidden;
    min-height: 0;
  `,
  expandedBodyOpen: css`
    grid-template-rows: 1fr;
    opacity: 1;
  `,
  lyricLine: css`
    padding-block: 6px;
    padding-inline: 10px;
    border-radius: 10px;
    transition:
      background 0.18s ${cssVar.motionEaseInOut},
      color 0.18s ${cssVar.motionEaseInOut};
  `,
  lyricLineActive: css`
    color: ${cssVar.colorText};
    background: rgb(110 133 255 / 12%);
  `,
  modal: css`
    .ant-modal-content {
      overflow: hidden;
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 28px;
      background:
        radial-gradient(circle at 10% 0%, rgb(100 160 255 / 12%), transparent 30%),
        ${cssVar.colorBgLayout};
    }
  `,
  modalArtwork: css`
    flex: 0 0 280px;
  `,
  playerRail: css`
    overflow: hidden;
    height: 10px;
    border-radius: 999px;
    background: rgb(255 255 255 / 8%);
  `,
  playerRailTrack: css`
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #6e8bff 0%, #47d9c6 48%, #f9f0ff 100%);
  `,
  playButtonReady: css`
    box-shadow:
      0 0 0 1px rgb(87 217 197 / 28%),
      0 0 28px rgb(87 217 197 / 22%);
    animation: ready-play-pulse 1.8s ease-in-out infinite;

    @keyframes ready-play-pulse {
      0%,
      100% {
        filter: saturate(1);
      }

      50% {
        filter: saturate(1.3);
      }
    }
  `,
  pulseBar: css`
    position: relative;

    overflow: hidden;

    height: 8px;
    border-radius: 999px;

    background: linear-gradient(
      90deg,
      rgb(123 159 255 / 18%),
      rgb(127 226 212 / 70%),
      rgb(255 255 255 / 28%)
    );

    &::after {
      content: '';

      position: absolute;
      inset: 0;

      background: repeating-linear-gradient(
        90deg,
        rgb(255 255 255 / 72%) 0,
        rgb(255 255 255 / 72%) 6px,
        transparent 6px,
        transparent 12px
      );

      animation: pulse-bars 1.6s linear infinite;

      mask-image: linear-gradient(90deg, transparent, black 20%, black 80%, transparent);
    }

    @keyframes pulse-bars {
      from {
        transform: translateX(-24px);
      }

      to {
        transform: translateX(24px);
      }
    }
  `,
  seekSlider: css`
    margin: 0 !important;

    .ant-slider-rail {
      background: rgb(255 255 255 / 8%) !important;
    }

    .ant-slider-track {
      background: linear-gradient(90deg, #6e8bff 0%, #47d9c6 48%, #f9f0ff 100%) !important;
    }

    .ant-slider-handle::after {
      width: 14px !important;
      height: 14px !important;
      background: rgb(250 250 255 / 95%) !important;
      box-shadow: 0 0 0 4px rgb(255 255 255 / 12%) !important;
    }
  `,
  visualizerShell: css`
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 4%);
    border-radius: 18px;
    background: rgb(255 255 255 / 3%);
  `,
}));

const providerLabelMap: Record<
  string,
  'generation.providerMode.classic' | 'generation.providerMode.lyria'
> = {
  'kie-ai': 'generation.providerMode.classic',
  'openrouter': 'generation.providerMode.lyria',
};

const formatTime = (seconds = 0) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = String(total % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const sanitizeFileName = (value: string) =>
  value.replaceAll(/["%*/:<>?\\|]/g, '').replaceAll(/\s+/g, '_');

const getPlayProgress = (currentTime: number, duration: number) => {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
};

const isGenericTrackTitle = (value?: string) => /^track \d+$/i.test(value?.trim() || '');

const resolveTrackTitle = ({
  assetTitle,
  batchPrompt,
  batchTitle,
  index,
}: {
  assetTitle?: string;
  batchPrompt?: string;
  batchTitle?: string;
  index: number;
}) => {
  if (assetTitle && !isGenericTrackTitle(assetTitle)) return assetTitle;
  if (batchTitle?.trim()) return batchTitle.trim();
  if (batchPrompt?.trim()) return batchPrompt.trim();
  return assetTitle || `Track ${index + 1}`;
};

const getTrackStatus = (generation: Generation) => {
  const asset = generation.asset as AudioGenerationAsset | null | undefined;
  if (asset?.url) return 'playable';
  return generation.task.status;
};

const useTrackUpdater = (topicId: string | null, batch: GenerationBatch) => {
  return useCallback(
    (nextGeneration: Generation) => {
      if (!topicId) return;

      const currentStore = useAudioStore.getState();
      const currentBatch = currentStore.generationBatchesMap[topicId]?.find(
        (item) => item.id === batch.id,
      );

      const sourceBatch = currentBatch || batch;

      currentStore.internal_dispatchGenerationBatch(
        topicId,
        {
          ...sourceBatch,
          generations: sourceBatch.generations.map((generation) =>
            generation.id === nextGeneration.id ? nextGeneration : generation,
          ),
        },
        'audioWorkspace/updateTrack',
      );
    },
    [batch, topicId],
  );
};

interface TrackCardProps {
  batch: GenerationBatch;
  generation: Generation;
  index: number;
  topicId: string;
}

const TrackCard = memo<TrackCardProps>(({ batch, generation, index, topicId }) => {
  const { message } = App.useApp();
  const { t } = useTranslation('audio');
  const updateTrack = useTrackUpdater(topicId, batch);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.92);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const asset = generation.asset as AudioGenerationAsset | null | undefined;
  const config = (batch.config as {
    artist?: string;
    modelVersion?: 'V1.0' | 'V2.0' | 'V3.0';
    title?: string;
  }) || { modelVersion: 'V3.0' as const };
  const playableUrl = asset?.url || asset?.originalUrl;
  const title = resolveTrackTitle({
    assetTitle: asset?.title,
    batchPrompt: batch.prompt,
    batchTitle: config.title,
    index,
  });
  const artist = asset?.artist || config.artist || t('generation.artistFallback');
  const modelVersion = asset?.modelVersion || config.modelVersion || 'V3.0';
  const status = getTrackStatus(generation);
  const lyrics = asset?.lyrics;
  const hasLyrics = Boolean(lyrics?.alignedWords?.length);
  const playProgress = getPlayProgress(currentTime, duration);
  const activeLyricIndex = (lyrics?.alignedWords || []).findIndex((item) => {
    if (!item?.startS && !item?.endS) return false;
    return (
      currentTime >= (item.startS || 0) && currentTime <= (item.endS || Number.MAX_SAFE_INTEGER)
    );
  });

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (!playableUrl && isPlaying) setIsPlaying(false);
  }, [isPlaying, playableUrl]);

  const syncTrack = useCallback(
    (nextGeneration: Generation) => {
      updateTrack(nextGeneration);
    },
    [updateTrack],
  );

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !playableUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    await audio.play();
    setIsPlaying(true);
  }, [isPlaying, playableUrl]);

  const handleArtworkClick = useCallback(() => {
    if (playableUrl) {
      void handlePlayPause();
      return;
    }

    setExpanded((open) => !open);
  }, [handlePlayPause, playableUrl]);

  const handleDownload = useCallback(async () => {
    if (!playableUrl) return;

    const extension = playableUrl.split('?')[0].split('.').pop() || 'mp3';
    const fileName = `${sanitizeFileName(title)}-${sanitizeFileName(artist)}.${extension.length > 8 ? 'mp3' : extension}`;

    try {
      await downloadFile(playableUrl, fileName, false);
      message.success(t('generation.download'));
    } catch (error) {
      console.error('Failed to download audio:', error);
      message.error(t('generation.failed'));
    }
  }, [artist, message, playableUrl, t, title]);

  const handleShare = useCallback(async () => {
    if (!playableUrl) return;

    try {
      if (navigator.share) {
        await navigator.share({
          text: `${title} by ${artist}`,
          title,
          url: playableUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(playableUrl);
      message.success(t('generation.shareCopied'));
    } catch (error) {
      console.error('Failed to share audio:', error);
      message.error(t('generation.failed'));
    }
  }, [artist, message, playableUrl, t, title]);

  const runTrackAction = useCallback(
    async (
      action: 'lyrics' | 'cover' | 'video' | 'vocals',
      handler: () => Promise<
        { generation?: Generation; lyrics?: unknown } | { generation?: Generation; taskId?: string }
      >,
    ) => {
      setActionLoading(action);
      try {
        const result = await handler();
        if ('generation' in result && result.generation) {
          syncTrack(result.generation);
        }
        if (action === 'lyrics' && 'lyrics' in result && result.lyrics) {
          message.success(t('generation.lyricsReady'));
        } else {
          message.success(t(`generation.actions.${action}`));
        }
      } catch (error) {
        console.error(`Track action ${action} failed:`, error);
        message.error(t('generation.failed'));
      } finally {
        setActionLoading(null);
      }
    },
    [message, syncTrack, t],
  );

  const handleLyrics = useCallback(async () => {
    if (!playableUrl) return;

    if (lyrics) {
      setFullscreenOpen(true);
      return;
    }

    setLyricsLoading(true);
    try {
      const response = await audioService.getTimestampedLyrics(generation.id);
      if (response.generation) {
        syncTrack(response.generation);
      }
      setFullscreenOpen(true);
      message.success(t('generation.lyricsReady'));
    } catch (error) {
      console.error('Failed to load lyrics:', error);
      message.error(t('generation.failed'));
    } finally {
      setLyricsLoading(false);
    }
  }, [generation.id, lyrics, message, playableUrl, syncTrack, t]);

  const handleVocals = useCallback(async () => {
    await runTrackAction('vocals', async () => audioService.separateVocals(generation.id));
  }, [generation.id, runTrackAction]);

  const handleCover = useCallback(async () => {
    await runTrackAction('cover', async () => audioService.generateMusicCover(generation.id));
  }, [generation.id, runTrackAction]);

  const handleVideo = useCallback(async () => {
    await runTrackAction('video', async () => audioService.createMusicVideo(generation.id));
  }, [generation.id, runTrackAction]);

  const handleSeek = useCallback((nextValue: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextValue)) return;
    audio.currentTime = nextValue;
    setCurrentTime(nextValue);
  }, []);

  const moreMenuItems = useMemo<ItemType[]>(
    () => [
      {
        disabled: !playableUrl || actionLoading === 'lyrics' || lyricsLoading,
        icon: <Icon icon={MessageCircleMore} />,
        key: 'lyrics',
        label: t('generation.actions.lyrics'),
        onClick: () => {
          void handleLyrics();
        },
      },
      {
        disabled: !asset?.audioId || actionLoading === 'vocals',
        icon: <Icon icon={MicVocal} />,
        key: 'vocals',
        label: t('generation.actions.vocals'),
        onClick: () => {
          void handleVocals();
        },
      },
      {
        disabled: actionLoading === 'cover',
        icon: <Icon icon={RefreshCcw} />,
        key: 'cover',
        label: t('generation.actions.cover'),
        onClick: () => {
          void handleCover();
        },
      },
      {
        disabled: !asset?.audioId || actionLoading === 'video',
        icon: <Icon icon={Expand} />,
        key: 'video',
        label: t('generation.actions.video'),
        onClick: () => {
          void handleVideo();
        },
      },
    ],
    [
      actionLoading,
      asset?.audioId,
      handleCover,
      handleLyrics,
      handleVideo,
      handleVocals,
      lyricsLoading,
      playableUrl,
      t,
    ],
  );

  return (
    <Block
      className={`${styles.audioCard} ${playableUrl ? styles.audioCardActive : ''}`}
      gap={0}
      variant="borderless"
    >
      <audio
        ref={audioRef}
        src={playableUrl}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(event) => setDuration((event.target as HTMLAudioElement).duration || 0)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) =>
          setCurrentTime((event.target as HTMLAudioElement).currentTime || 0)
        }
      />

      <Flexbox horizontal align="stretch" gap={16} padding={16}>
        <div className={`${styles.artwork} ${playableUrl ? styles.artworkReady : ''}`}>
          <button className={styles.artworkButton} type="button" onClick={handleArtworkClick}>
            {asset?.coverUrl ? (
              <img alt={title} className={styles.artworkImage} src={asset.coverUrl} />
            ) : (
              <div className={styles.artworkPlaceholder}>
                <Music2 size={32} />
                <Text strong style={{ color: 'white', textAlign: 'center' }}>
                  {title}
                </Text>
              </div>
            )}

            <div
              className={`${styles.artworkOverlay} ${playableUrl ? styles.artworkOverlayReady : ''}`}
            >
              <Icon icon={isPlaying ? Pause : Play} />
            </div>
          </button>
        </div>

        <Flexbox flex={1} gap={12} style={{ minWidth: 0 }}>
          <Flexbox horizontal align="flex-start" gap={12} justify="space-between">
            <Flexbox gap={6} style={{ minWidth: 0 }}>
              <Text ellipsis weight={700}>
                {title}
              </Text>
              <Text ellipsis fontSize={12} type="secondary">
                {artist}
              </Text>
              <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
                <Tag>{modelVersion}</Tag>
                <Tag color={asset?.url ? 'success' : status === 'error' ? 'error' : 'blue'}>
                  {asset?.url
                    ? t('generation.playable')
                    : status === 'error'
                      ? t('feed.status.failed')
                      : t('feed.status.processing')}
                </Tag>
              </Flexbox>
            </Flexbox>

            <Button
              icon={<Icon icon={expanded ? ChevronDown : ChevronRight} />}
              shape="round"
              type={expanded ? 'default' : 'text'}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? t('generation.hidePlayer') : t('generation.openPlayer')}
            </Button>
          </Flexbox>

          <div className={`${styles.expandedBody} ${expanded ? styles.expandedBodyOpen : ''}`}>
            <div className={styles.expandedBodyInner}>
              <Flexbox gap={12} paddingBlock={4}>
                <div className={styles.visualizerShell}>
                  {playableUrl ? (
                    <Visualizer audioRef={audioRef} isPlaying={isPlaying} />
                  ) : (
                    <div className={styles.pulseBar} />
                  )}
                </div>

                <div className={styles.playerRail}>
                  <div
                    className={styles.playerRailTrack}
                    style={{ width: `${Math.max(playProgress, playableUrl ? 4 : 10)}%` }}
                  />
                </div>

                <Slider
                  className={styles.seekSlider}
                  disabled={!playableUrl || duration <= 0}
                  max={Math.max(duration, 0)}
                  min={0}
                  step={0.1}
                  tooltip={{ formatter: (value) => formatTime(Number(value || 0)) }}
                  value={Math.min(currentTime, duration || currentTime)}
                  onChange={(value) => handleSeek(value as number)}
                />

                <Flexbox horizontal align="center" gap={10} style={{ flexWrap: 'wrap' }}>
                  <Button
                    className={playableUrl ? styles.playButtonReady : undefined}
                    disabled={!playableUrl}
                    icon={<Icon icon={isPlaying ? Pause : Play} />}
                    shape="round"
                    type="primary"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? t('generation.pause') : t('generation.play')}
                  </Button>
                  <Button
                    disabled={!playableUrl}
                    icon={<Icon icon={Expand} />}
                    shape="round"
                    onClick={() => setFullscreenOpen(true)}
                  >
                    {t('generation.fullscreen')}
                  </Button>
                  <Button
                    disabled={!playableUrl}
                    icon={<Icon icon={Download} />}
                    shape="round"
                    onClick={handleDownload}
                  >
                    {t('generation.download')}
                  </Button>
                  <Button
                    disabled={!playableUrl}
                    icon={<Icon icon={Share2} />}
                    shape="round"
                    onClick={handleShare}
                  >
                    {t('generation.share')}
                  </Button>
                  <DropdownMenu items={moreMenuItems}>
                    <Button
                      icon={<Icon icon={MoreVertical} />}
                      loading={Boolean(actionLoading) || lyricsLoading}
                      shape="round"
                    >
                      {t('generation.more')}
                    </Button>
                  </DropdownMenu>
                </Flexbox>

                <Flexbox horizontal align="center" gap={12} style={{ flexWrap: 'wrap' }}>
                  <Flexbox horizontal align="center" gap={8} style={{ minWidth: 260 }}>
                    <VolumeX size={15} />
                    <Slider
                      max={1}
                      min={0}
                      step={0.01}
                      style={{ flex: 1, margin: 0 }}
                      tooltip={{ formatter: null }}
                      value={volume}
                      onChange={(value) => setVolume(value as number)}
                    />
                    <Volume2 size={15} />
                  </Flexbox>
                  <Text fontSize={12} type="secondary">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>
                </Flexbox>
              </Flexbox>
            </div>
          </div>
        </Flexbox>
      </Flexbox>

      <Modal
        className={styles.modal}
        footer={null}
        open={fullscreenOpen}
        style={{ top: 0 }}
        title={`${title} · ${artist}`}
        width="100vw"
        onCancel={() => setFullscreenOpen(false)}
      >
        <Flexbox gap={18} padding={20}>
          <Flexbox horizontal align="stretch" gap={18}>
            <div
              className={`${styles.artwork} ${styles.modalArtwork} ${playableUrl ? styles.artworkReady : ''}`}
            >
              {asset?.coverUrl ? (
                <img alt={title} className={styles.artworkImage} src={asset.coverUrl} />
              ) : (
                <div className={styles.artworkPlaceholder}>
                  <Music2 size={40} />
                </div>
              )}
            </div>

            <Flexbox flex={1} gap={12} style={{ minWidth: 0 }}>
              <Flexbox horizontal align="center" gap={8} justify="space-between">
                <Flexbox gap={4} style={{ minWidth: 0 }}>
                  <Text ellipsis fontSize={20} weight={700}>
                    {title}
                  </Text>
                  <Text ellipsis type="secondary">
                    {artist} · {modelVersion}
                  </Text>
                </Flexbox>
                <Tag color={asset?.url ? 'success' : 'blue'}>
                  {asset?.url ? t('generation.playable') : t('feed.status.processing')}
                </Tag>
              </Flexbox>

              <div className={styles.visualizerShell}>
                {playableUrl ? (
                  <Visualizer audioRef={audioRef} isPlaying={isPlaying} />
                ) : (
                  <div className={styles.pulseBar} />
                )}
              </div>

              <div className={styles.playerRail}>
                <div
                  className={styles.playerRailTrack}
                  style={{ width: `${Math.max(playProgress, playableUrl ? 4 : 10)}%` }}
                />
              </div>

              <Slider
                className={styles.seekSlider}
                disabled={!playableUrl || duration <= 0}
                max={Math.max(duration, 0)}
                min={0}
                step={0.1}
                tooltip={{ formatter: (value) => formatTime(Number(value || 0)) }}
                value={Math.min(currentTime, duration || currentTime)}
                onChange={(value) => handleSeek(value as number)}
              />

              <Flexbox horizontal align="center" gap={12} style={{ flexWrap: 'wrap' }}>
                <Button
                  className={playableUrl ? styles.playButtonReady : undefined}
                  disabled={!playableUrl}
                  icon={<Icon icon={isPlaying ? Pause : Play} />}
                  shape="round"
                  type="primary"
                  onClick={handlePlayPause}
                >
                  {isPlaying ? t('generation.pause') : t('generation.play')}
                </Button>
                <Button
                  disabled={!playableUrl}
                  icon={<Icon icon={Download} />}
                  shape="round"
                  onClick={handleDownload}
                >
                  {t('generation.download')}
                </Button>
                <Button
                  disabled={!playableUrl}
                  icon={<Icon icon={Share2} />}
                  shape="round"
                  onClick={handleShare}
                >
                  {t('generation.share')}
                </Button>
                <DropdownMenu items={moreMenuItems}>
                  <Button icon={<Icon icon={MoreVertical} />} shape="round">
                    {t('generation.more')}
                  </Button>
                </DropdownMenu>
              </Flexbox>

              <Flexbox horizontal align="center" gap={10} style={{ flexWrap: 'wrap' }}>
                <Flexbox horizontal align="center" gap={8} style={{ minWidth: 320 }}>
                  <VolumeX size={15} />
                  <Slider
                    max={1}
                    min={0}
                    step={0.01}
                    style={{ flex: 1, margin: 0 }}
                    tooltip={{ formatter: null }}
                    value={volume}
                    onChange={(value) => setVolume(value as number)}
                  />
                  <Volume1 size={15} />
                </Flexbox>
                <Text fontSize={12} type="secondary">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>
              </Flexbox>
            </Flexbox>
          </Flexbox>

          <Flexbox gap={10}>
            <Text weight={700}>{t('generation.lyrics')}</Text>
            {hasLyrics ? (
              <Flexbox gap={6} style={{ maxHeight: '48vh', overflow: 'auto' }}>
                {(lyrics?.alignedWords || []).map((word, wordIndex) => {
                  const isActive = wordIndex === activeLyricIndex;
                  return (
                    <div
                      className={`${styles.lyricLine} ${isActive ? styles.lyricLineActive : ''}`}
                      key={`${word.word}-${word.startS ?? wordIndex}`}
                    >
                      <Text style={{ whiteSpace: 'pre-wrap' }}>{word.word || ''}</Text>
                    </div>
                  );
                })}
              </Flexbox>
            ) : (
              <Empty description={t('generation.noLyrics')} />
            )}
          </Flexbox>
        </Flexbox>
      </Modal>
    </Block>
  );
});

TrackCard.displayName = 'TrackCard';

interface AudioWorkspaceProps {
  embedInput?: boolean;
}

export const AudioWorkspace = memo<AudioWorkspaceProps>(() => {
  const { t } = useTranslation('audio');
  const activeTopicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const useFetchGenerationBatches = useAudioStore((state) => state.useFetchGenerationBatches);
  const pollAudioStatus = useAudioStore((state) => state.pollAudioStatus);
  const batches = useAudioStore((state) =>
    audioGenerationBatchSelectors.batches(activeTopicId || '')(state),
  );
  const isLoadingTopic = useAudioStore((state) =>
    audioGenerationTopicSelectors.isLoadingGenerationTopic(activeTopicId || '')(state),
  );
  const resumedTaskIdsRef = useRef<Set<string>>(new Set());

  const batchFetchState = useFetchGenerationBatches(activeTopicId);

  useEffect(() => {
    if (!activeTopicId || !batches.length) return;

    for (const batch of batches) {
      const processingGeneration = batch.generations.find(
        (generation) =>
          generation.asyncTaskId && generation.task.status === AsyncTaskStatus.Processing,
      );

      if (!processingGeneration?.asyncTaskId) continue;

      const resumeKey = `${activeTopicId}:${processingGeneration.asyncTaskId}`;
      if (resumedTaskIdsRef.current.has(resumeKey)) continue;

      resumedTaskIdsRef.current.add(resumeKey);
      void pollAudioStatus({
        asyncTaskId: processingGeneration.asyncTaskId,
        batchId: batch.id,
        topicId: activeTopicId,
      });
    }
  }, [activeTopicId, batches, pollAudioStatus]);

  if (!activeTopicId) {
    return (
      <Flexbox align="center" justify="center" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <Empty description={t('generation.noTopic')} />
      </Flexbox>
    );
  }

  if (isLoadingTopic || batchFetchState.isLoading) {
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
      {batches.map((batch) => {
        const config =
          (batch.config as { artist?: string; modelVersion?: string } | undefined) || {};
        const providerLabel = providerLabelMap[batch.provider]
          ? t(providerLabelMap[batch.provider])
          : t('generation.providerMode.classic');

        return (
          <Block
            className={styles.batchCard}
            gap={16}
            key={batch.id}
            padding={16}
            variant="borderless"
          >
            <Flexbox gap={8}>
              <Flexbox horizontal align="center" gap={12} justify="space-between">
                <Flexbox gap={4} style={{ minWidth: 0 }}>
                  <Markdown variant="chat">{batch.prompt}</Markdown>
                  <Text fontSize={12} type="secondary">
                    {config.artist || t('generation.artistFallback')}
                    {' · '}
                    {new Date(batch.createdAt).toLocaleString()}
                  </Text>
                </Flexbox>
                <Flexbox
                  horizontal
                  align="center"
                  gap={8}
                  style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}
                >
                  <Tag>{providerLabel}</Tag>
                  <Tag>{config.modelVersion || 'V3.0'}</Tag>
                </Flexbox>
              </Flexbox>
            </Flexbox>

            <Flexbox gap={14}>
              {batch.generations.map((generation, index) => (
                <TrackCard
                  batch={batch}
                  generation={generation}
                  index={index}
                  key={generation.id}
                  topicId={activeTopicId}
                />
              ))}
            </Flexbox>
          </Block>
        );
      })}
    </Flexbox>
  );
});

AudioWorkspace.displayName = 'AudioWorkspace';
