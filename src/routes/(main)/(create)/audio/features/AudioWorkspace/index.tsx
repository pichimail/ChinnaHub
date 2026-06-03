'use client';

import { Block, Button, Flexbox, Icon, Markdown, Text } from '@lobehub/ui';
import { App, Empty, Modal, Slider, Spin, Tag } from 'antd';
import { createStaticStyles } from 'antd-style';
import {
  Download,
  Expand,
  MessageCircleMore,
  MicVocal,
  Music2,
  Pause,
  Play,
  RefreshCcw,
  Share2,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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

    aspect-ratio: 1;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

    background:
      radial-gradient(circle at 25% 25%, rgb(255 255 255 / 38%), transparent 28%),
      linear-gradient(
        135deg,
        rgb(92 132 255 / 75%),
        rgb(146 68 255 / 65%) 50%,
        rgb(36 196 163 / 72%)
      );
    box-shadow: 0 12px 40px rgb(0 0 0 / 16%);
  `,
  audioCard: css`
    position: relative;

    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;

    background: linear-gradient(180deg, rgb(255 255 255 / 6%), rgb(255 255 255 / 2%));
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
  chip: css`
    border-radius: 999px !important;
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
  waveformRail: css`
    overflow: hidden;
    height: 10px;
    border-radius: 999px;
    background: rgb(255 255 255 / 8%);
  `,
  waveformTrack: css`
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #6e8bff 0%, #47d9c6 48%, #f9f0ff 100%);
  `,
}));

const providerModelLabelMap: Record<'V1.0' | 'V2.0' | 'V3.0', string> = {
  'V1.0': 'V4_5ALL',
  'V2.0': 'V5',
  'V3.0': 'V5_5',
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.92);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const asset = generation.asset as AudioGenerationAsset | null | undefined;
  const playableUrl = asset?.url || asset?.originalUrl;
  const title = asset?.title || `Track ${index + 1}`;
  const artist =
    asset?.artist || (batch.config as { artist?: string } | undefined)?.artist || 'ChinnaHub';
  const modelVersion =
    asset?.modelVersion ||
    (batch.config as { modelVersion?: 'V1.0' | 'V2.0' | 'V3.0' } | undefined)?.modelVersion ||
    'V3.0';
  const status = getTrackStatus(generation);
  const lyrics = asset?.lyrics;
  const lyricWords = lyrics?.alignedWords || [];
  const activeLyricIndex = lyricWords.findIndex((item) => {
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
    if (!playableUrl && isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying, playableUrl]);

  useEffect(() => {
    if (!playableUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [playableUrl, volume]);

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

  const handleDownload = useCallback(async () => {
    if (!playableUrl) return;

    const extension = playableUrl.split('?')[0].split('.').pop() || 'mp3';
    const fileName = `${sanitizeFileName(artist)} - ${sanitizeFileName(title)}.${extension.length > 8 ? 'mp3' : extension}`;

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

  const handleFullscreenToggle = useCallback(() => {
    setFullscreenOpen(true);
  }, []);

  const displayProgress = getPlayProgress(currentTime, duration);
  const hasLyrics = Boolean(lyrics?.alignedWords?.length);

  return (
    <Block
      className={`${styles.audioCard} ${playableUrl ? styles.audioCardActive : ''}`}
      gap={0}
      variant="borderless"
    >
      <Flexbox horizontal align="stretch" gap={16} padding={16}>
        <div className={styles.artwork} style={{ width: 138 }}>
          <Flexbox align="center" height="100%" justify="center" padding={16}>
            {asset?.coverUrl ? (
              <img
                alt={title}
                src={asset.coverUrl}
                style={{ borderRadius: 18, height: '100%', objectFit: 'cover', width: '100%' }}
              />
            ) : (
              <Flexbox align="center" gap={12} justify="center" style={{ color: 'white' }}>
                <Music2 size={28} />
                <Text strong style={{ color: 'white' }}>
                  {title}
                </Text>
              </Flexbox>
            )}
          </Flexbox>
        </div>

        <Flexbox flex={1} gap={10} style={{ minWidth: 0 }}>
          <Flexbox horizontal align="center" gap={8} justify="space-between">
            <Flexbox gap={2} style={{ minWidth: 0 }}>
              <Text ellipsis weight={700}>
                {title}
              </Text>
              <Text ellipsis fontSize={12} type="secondary">
                {artist} · {providerModelLabelMap[modelVersion] ?? modelVersion}
              </Text>
            </Flexbox>

            <Tag color={asset?.url ? 'success' : status === 'error' ? 'error' : 'blue'}>
              {asset?.url
                ? t('generation.playable')
                : status === 'error'
                  ? t('feed.status.failed')
                  : t('feed.status.processing')}
            </Tag>
          </Flexbox>

          {playableUrl ? (
            <Visualizer audioRef={audioRef} isPlaying={isPlaying} />
          ) : (
            <div className={styles.pulseBar} />
          )}

          <div className={styles.waveformRail}>
            <div
              className={styles.waveformTrack}
              style={{ width: `${Math.max(displayProgress, 6)}%` }}
            />
          </div>

          <audio
            ref={audioRef}
            src={playableUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onLoadedMetadata={(event) =>
              setDuration((event.target as HTMLAudioElement).duration || 0)
            }
            onTimeUpdate={(event) =>
              setCurrentTime((event.target as HTMLAudioElement).currentTime || 0)
            }
          />

          <Flexbox horizontal align="center" gap={10} style={{ flexWrap: 'wrap' }}>
            <Button
              disabled={!playableUrl}
              icon={<Icon icon={isPlaying ? Pause : Play} />}
              shape="round"
              type="primary"
              onClick={handlePlayPause}
            >
              {isPlaying ? t('generation.pause') : t('generation.play')}
            </Button>
            <Button icon={<Icon icon={Expand} />} shape="round" onClick={handleFullscreenToggle}>
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
          </Flexbox>

          <Flexbox horizontal align="center" gap={12} style={{ flexWrap: 'wrap' }}>
            <Flexbox horizontal align="center" gap={8} style={{ minWidth: 240 }}>
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

          <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
            <Button
              className={styles.chip}
              disabled={!playableUrl || actionLoading === 'lyrics' || lyricsLoading}
              icon={<Icon icon={MessageCircleMore} />}
              loading={actionLoading === 'lyrics' || lyricsLoading}
              size="small"
              onClick={handleLyrics}
            >
              {t('generation.actions.lyrics')}
            </Button>
            <Button
              className={styles.chip}
              disabled={!asset?.audioId || actionLoading === 'vocals'}
              icon={<Icon icon={MicVocal} />}
              loading={actionLoading === 'vocals'}
              size="small"
              onClick={handleVocals}
            >
              {t('generation.actions.vocals')}
            </Button>
            <Button
              className={styles.chip}
              disabled={actionLoading === 'cover'}
              icon={<Icon icon={RefreshCcw} />}
              loading={actionLoading === 'cover'}
              size="small"
              onClick={handleCover}
            >
              {t('generation.actions.cover')}
            </Button>
            <Button
              className={styles.chip}
              disabled={!asset?.audioId || actionLoading === 'video'}
              icon={<Icon icon={Expand} />}
              loading={actionLoading === 'video'}
              size="small"
              onClick={handleVideo}
            >
              {t('generation.actions.video')}
            </Button>
          </Flexbox>
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
            <div className={styles.artwork} style={{ flex: '0 0 280px' }}>
              {asset?.coverUrl ? (
                <img
                  alt={title}
                  src={asset.coverUrl}
                  style={{ borderRadius: 22, height: '100%', objectFit: 'cover', width: '100%' }}
                />
              ) : (
                <Flexbox align="center" height="100%" justify="center">
                  <Music2 color="white" size={40} />
                </Flexbox>
              )}
            </div>

            <Flexbox flex={1} gap={12} style={{ minWidth: 0 }}>
              <Flexbox horizontal align="center" gap={8} justify="space-between">
                <Flexbox gap={2} style={{ minWidth: 0 }}>
                  <Text ellipsis fontSize={20} weight={700}>
                    {title}
                  </Text>
                  <Text ellipsis type="secondary">
                    {artist} · {providerModelLabelMap[modelVersion] ?? modelVersion}
                  </Text>
                </Flexbox>
                <Tag color={asset?.url ? 'success' : 'blue'}>
                  {asset?.url ? t('generation.playable') : t('feed.status.processing')}
                </Tag>
              </Flexbox>

              {playableUrl ? (
                <Visualizer audioRef={audioRef} isPlaying={isPlaying} />
              ) : (
                <div className={styles.pulseBar} />
              )}

              <div className={styles.waveformRail}>
                <div
                  className={styles.waveformTrack}
                  style={{ width: `${Math.max(displayProgress, 6)}%` }}
                />
              </div>

              <Flexbox horizontal align="center" gap={12} style={{ flexWrap: 'wrap' }}>
                <Button
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
                <Button icon={<Icon icon={Share2} />} shape="round" onClick={handleShare}>
                  {t('generation.share')}
                </Button>
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
                  const lineText = word.word || '';
                  return (
                    <div
                      className={`${styles.lyricLine} ${isActive ? styles.lyricLineActive : ''}`}
                      key={`${word.word}-${word.startS ?? wordIndex}`}
                    >
                      <Text style={{ whiteSpace: 'pre-wrap' }}>{lineText}</Text>
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
                  {(batch.config as { artist?: string } | undefined)?.artist ||
                    t('generation.artistFallback')}
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
                <Tag>{batch.provider}</Tag>
                <Tag>
                  {(batch.config as { modelVersion?: string } | undefined)?.modelVersion || 'V3.0'}
                </Tag>
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
      ))}
    </Flexbox>
  );
});

AudioWorkspace.displayName = 'AudioWorkspace';
