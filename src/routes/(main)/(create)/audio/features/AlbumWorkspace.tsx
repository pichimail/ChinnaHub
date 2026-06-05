'use client';

import { AsyncTaskStatus } from '@lobechat/types';
import { Block, Button, Flexbox, Grid, Icon, Markdown, Text } from '@lobehub/ui';
import { App, Dropdown, Input, Modal, Select, Slider } from 'antd';
import { createStaticStyles } from 'antd-style';
import {
  Disc3,
  Download,
  Expand,
  MessageCircleMore,
  MoreVertical,
  Pause,
  Play,
  Share2,
} from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { audioActionService } from '@/services/audioAction';
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
  album: css`
    position: relative;

    overflow: hidden;

    aspect-ratio: 1;
    width: 100%;
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorFillSecondary};

    &:hover .audio-ready-controls,
    &:focus-within .audio-ready-controls {
      pointer-events: auto;
      opacity: 1;
    }
  `,
  artwork: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,
  artworkButton: css`
    cursor: pointer;

    position: absolute;
    inset: 0;

    padding: 0;
    border: 0;

    background: transparent;
  `,
  bottomControls: css`
    pointer-events: none;

    position: absolute;
    z-index: 3;
    inset-block-end: 12px;
    inset-inline: 12px;

    display: flex;
    gap: 10px;
    align-items: center;

    opacity: 0;

    transition: opacity ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut};

    @media (width <= 768px) {
      pointer-events: auto;
      opacity: 1;
    }
  `,
  centerPlay: css`
    pointer-events: none;

    position: absolute;
    z-index: 3;
    inset-block-start: 50%;
    inset-inline-start: 50%;
    transform: translate(-50%, -50%);

    opacity: 0;

    transition: opacity ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut};

    @media (width <= 768px) {
      pointer-events: auto;
      opacity: 1;
    }
  `,
  controlButton: css`
    border-color: rgb(255 255 255 / 24%);
    color: white;
    background: rgb(0 0 0 / 52%);
    backdrop-filter: blur(12px);
  `,
  loading: css`
    position: absolute;
    z-index: 2;
    inset: 0;
    background: ${cssVar.colorFillSecondary};
  `,
  playButton: css`
    width: 58px;
    height: 58px;
    border-color: rgb(255 255 255 / 30%);

    color: white;

    background: rgb(0 0 0 / 58%);
    backdrop-filter: blur(14px);
  `,
  placeholder: css`
    position: absolute;
    inset: 0;
    color: ${cssVar.colorTextTertiary};
  `,
  time: css`
    min-width: 36px;
    color: white;
  `,
  topControls: css`
    pointer-events: none;

    position: absolute;
    z-index: 3;
    inset-block-start: 12px;
    inset-inline: 12px;

    display: flex;
    justify-content: flex-end;

    opacity: 0;

    transition: opacity ${cssVar.motionDurationFast} ${cssVar.motionEaseInOut};

    @media (width <= 768px) {
      pointer-events: auto;
      opacity: 1;
    }
  `,
}));

const getAudio = (asset?: AudioGenerationAsset | null) => asset?.url || asset?.originalUrl;
const safeName = (value: string) => value.replaceAll(/["%*/:<>?\\|]/g, '').replaceAll(/\s+/g, '_');

interface BatchAudioConfig {
  taskId?: string;
  title?: string;
}

interface TileProps {
  batch: GenerationBatch;
  generation: Generation;
  index: number;
}

const Tile = memo<TileProps>(({ batch, generation, index }) => {
  const { message } = App.useApp();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editAction, setEditAction] = useState('extend');
  const [editPrompt, setEditPrompt] = useState('');

  const asset = generation.asset as AudioGenerationAsset | undefined;
  const config = (batch.config || {}) as BatchAudioConfig;
  const audioUrl = getAudio(asset);
  const artUrl = asset?.coverUrl;
  const title = asset?.title || config.title || `Track ${index + 1}`;
  const taskId = asset?.parentTaskId || config.taskId;
  const audioId = asset?.audioId || generation.id;
  const isLoading =
    generation.task.status === AsyncTaskStatus.Processing ||
    generation.task.status === AsyncTaskStatus.Pending;
  const isReady = Boolean(audioUrl);
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch (error) {
      console.error('Failed to play generated audio:', error);
      message.error('Unable to play this track.');
    }
  }, [audioUrl, message]);

  const runEdit = async () => {
    const payload = { audioId, prompt: editPrompt || batch.prompt, taskId };
    try {
      if (editAction === 'extend') await audioActionService.extendMusic(payload);
      if (editAction === 'remix') await audioActionService.generateMashup(payload);
      if (editAction === 'addVocals') await audioActionService.addVocals(payload);
      if (editAction === 'instrumental') await audioActionService.addInstrumental(payload);
      if (editAction === 'replace')
        await audioActionService.replaceSection({ ...payload, endTime: 30, startTime: 0 });
      if (editAction === 'boost')
        await audioActionService.boostStyle({ prompt: editPrompt || batch.prompt });
      if (editAction === 'cover')
        await audioActionService.generateMusicCover({ prompt: editPrompt, taskId });
      message.success('Action started');
      setEditOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Action failed');
    }
  };

  return (
    <Block className={styles.album} variant="filled">
      <button
        aria-label={isReady ? `${playing ? 'Pause' : 'Play'} ${title}` : title}
        className={styles.artworkButton}
        disabled={!isReady}
        type="button"
        onClick={() => void toggle()}
      >
        {artUrl && <img alt="" className={styles.artwork} src={artUrl} />}
        {!artUrl && !isLoading && (
          <Flexbox align="center" className={styles.placeholder} justify="center">
            <Icon icon={Disc3} size={46} />
          </Flexbox>
        )}
      </button>

      {isLoading && (
        <Flexbox align="center" className={styles.loading} justify="center">
          <NeuralNetworkLoading size={44} />
        </Flexbox>
      )}

      {isReady && (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime || 0)}
          />

          <Flexbox horizontal className={`${styles.topControls} audio-ready-controls`} gap={8}>
            <Button
              className={styles.controlButton}
              icon={<Icon icon={MessageCircleMore} />}
              shape="circle"
              title="Lyrics"
              onClick={() => message.info('Lyrics action ready')}
            />
            <Button
              className={styles.controlButton}
              icon={<Icon icon={Download} />}
              shape="circle"
              title="Download"
              onClick={() => downloadFile(audioUrl, `${safeName(title)}.mp3`, false)}
            />
            <Button
              className={styles.controlButton}
              icon={<Icon icon={Share2} />}
              shape="circle"
              title="Share"
              onClick={() => setShareOpen(true)}
            />
            <Button
              className={styles.controlButton}
              icon={<Icon icon={Expand} />}
              shape="circle"
              title="Expand"
              onClick={() => setFullOpen(true)}
            />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'extend', label: 'Extend' },
                  { key: 'remix', label: 'Remix / mashup' },
                  { key: 'addVocals', label: 'Add vocals' },
                  { key: 'instrumental', label: 'Add instrumental' },
                  { key: 'replace', label: 'Replace section' },
                  { key: 'boost', label: 'Boost style' },
                  { key: 'cover', label: 'Album art' },
                ],
                onClick: ({ key }) => {
                  setEditAction(String(key));
                  setEditOpen(true);
                },
              }}
            >
              <Button
                className={styles.controlButton}
                icon={<Icon icon={MoreVertical} />}
                shape="circle"
                title="More actions"
              />
            </Dropdown>
          </Flexbox>

          <div className={`${styles.centerPlay} audio-ready-controls`}>
            <Button
              className={styles.playButton}
              icon={<Icon icon={playing ? Pause : Play} size={30} />}
              shape="circle"
              title={playing ? 'Pause' : 'Play'}
              onClick={() => void toggle()}
            />
          </div>

          <div className={`${styles.bottomControls} audio-ready-controls`}>
            <Text className={styles.time} fontSize={12}>
              {Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, '0')}
            </Text>
            <Slider
              style={{ flex: 1, margin: 0 }}
              tooltip={{ open: false }}
              value={progress}
              onChange={(value) => {
                if (audioRef.current && duration) {
                  audioRef.current.currentTime = (value / 100) * duration;
                }
              }}
            />
          </div>
        </>
      )}

      <Modal
        centered
        footer={null}
        open={shareOpen}
        title="Share this track"
        onCancel={() => setShareOpen(false)}
      >
        <Flexbox gap={10}>
          <Input readOnly value={audioUrl || ''} />
          <Button onClick={() => audioUrl && navigator.clipboard.writeText(audioUrl)}>
            Copy link
          </Button>
        </Flexbox>
      </Modal>
      <Modal centered footer={null} open={fullOpen} width={720} onCancel={() => setFullOpen(false)}>
        <Flexbox gap={12}>
          {artUrl && <img alt={title} className={styles.artwork} src={artUrl} />}
          <Text>{title}</Text>
        </Flexbox>
      </Modal>
      <Modal
        centered
        okText="Start"
        open={editOpen}
        title="Edit track"
        onCancel={() => setEditOpen(false)}
        onOk={runEdit}
      >
        <Flexbox gap={12}>
          <Select
            value={editAction}
            options={[
              { label: 'Extend', value: 'extend' },
              { label: 'Remix / mashup', value: 'remix' },
              { label: 'Add vocals', value: 'addVocals' },
              { label: 'Add instrumental', value: 'instrumental' },
              { label: 'Replace section', value: 'replace' },
              { label: 'Boost style', value: 'boost' },
              { label: 'Album art', value: 'cover' },
            ]}
            onChange={setEditAction}
          />
          <Input.TextArea
            autoSize={{ maxRows: 5, minRows: 3 }}
            placeholder="Prompt or edit direction"
            value={editPrompt}
            onChange={(event) => setEditPrompt(event.target.value)}
          />
        </Flexbox>
      </Modal>
    </Block>
  );
});

Tile.displayName = 'AudioAlbumTile';

const Batch = memo<{ batch: GenerationBatch }>(({ batch }) => (
  <Block gap={8} variant="borderless">
    <Markdown variant="chat">{batch.prompt}</Markdown>
    <Grid maxItemWidth={360} rows={batch.generations.length}>
      {batch.generations.map((generation, index) => (
        <Tile batch={batch} generation={generation} index={index} key={generation.id} />
      ))}
    </Grid>
    <Text fontSize={12} type="secondary">
      {batch.generations.length} tracks
    </Text>
  </Block>
));

Batch.displayName = 'AudioAlbumBatch';

const AlbumWorkspace = memo(() => {
  const topicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore(audioGenerationBatchSelectors.currentGenerationBatches);
  if (!topicId || !batches.length) return null;

  return (
    <Flexbox gap={18} style={{ marginInline: 'auto', maxWidth: 760, width: '100%' }}>
      {batches.map((batch) => (
        <Batch batch={batch} key={batch.id} />
      ))}
    </Flexbox>
  );
});

AlbumWorkspace.displayName = 'AlbumWorkspace';
export default AlbumWorkspace;
