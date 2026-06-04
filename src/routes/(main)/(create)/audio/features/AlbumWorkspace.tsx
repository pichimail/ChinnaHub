'use client';

import { AsyncTaskStatus } from '@lobechat/types';
import { Block, Button, Flexbox, Grid, Icon, Markdown, Text } from '@lobehub/ui';
import { App, Dropdown, Input, Modal, Select, Slider } from 'antd';
import { Download, Expand, MessageCircleMore, MoreVertical, Pause, Play, Share2 } from 'lucide-react';
import { memo, useRef, useState } from 'react';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { audioActionService } from '@/services/audioAction';
import { audioGenerationBatchSelectors, audioGenerationTopicSelectors, useAudioStore } from '@/store/audio';
import { type AudioGenerationAsset, type Generation, type GenerationBatch } from '@/types/generation';
import { downloadFile } from '@/utils/client/downloadFile';

const getArt = (asset?: AudioGenerationAsset | null) => {
  const item = asset as any;
  return item?.coverUrl || item?.imageUrl || item?.thumbnailUrl || item?.coverImageUrl;
};

const getAudio = (asset?: AudioGenerationAsset | null) => asset?.url || asset?.originalUrl;
const safeName = (value: string) => value.replaceAll(/["%*/:<>?\\|]/g, '').replaceAll(/\s+/g, '_');

const Tile = memo<{ batch: GenerationBatch; generation: Generation; index: number }>(({ batch, generation, index }) => {
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
  const audioUrl = getAudio(asset);
  const artUrl = getArt(asset);
  const title = (asset as any)?.title || `Track ${index + 1}`;
  const taskId = (asset as any)?.taskId || (batch.config as any)?.taskId;
  const audioId = (asset as any)?.audioId || generation.id;
  const loading = generation.task.status === AsyncTaskStatus.Processing || generation.task.status === AsyncTaskStatus.Pending;
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;

  const toggle = async () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    await audioRef.current.play();
    setPlaying(true);
  };

  const runEdit = async () => {
    const payload = { audioId, prompt: editPrompt || batch.prompt, taskId };
    try {
      if (editAction === 'extend') await audioActionService.extendMusic(payload);
      if (editAction === 'remix') await audioActionService.generateMashup(payload);
      if (editAction === 'addVocals') await audioActionService.addVocals(payload);
      if (editAction === 'instrumental') await audioActionService.addInstrumental(payload);
      if (editAction === 'replace') await audioActionService.replaceSection({ ...payload, endTime: 30, startTime: 0 });
      if (editAction === 'boost') await audioActionService.boostStyle({ prompt: editPrompt || batch.prompt });
      if (editAction === 'cover') await audioActionService.generateMusicCover({ prompt: editPrompt, taskId });
      message.success('Action started');
      setEditOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Action failed');
    }
  };

  return (
    <Block
      variant="filled"
      style={{ aspectRatio: 1, overflow: 'hidden', position: 'relative', width: '100%' }}
    >
      {artUrl ? <img alt={title} src={artUrl} style={{ height: '100%', objectFit: 'cover', width: '100%' }} /> : null}
      {loading ? <Flexbox align="center" height="100%" justify="center"><NeuralNetworkLoading size={44} /></Flexbox> : null}
      {!loading && !artUrl ? <Flexbox align="center" height="100%" justify="center"><Icon icon={Play} size={42} /></Flexbox> : null}
      {audioUrl && <audio ref={audioRef} src={audioUrl} onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)} onEnded={() => setPlaying(false)} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime || 0)} />}
      <Flexbox horizontal justify="space-between" style={{ inset: 12, position: 'absolute' }}>
        <Button icon={<Icon icon={playing ? Pause : Play} />} shape="circle" onClick={toggle} />
        <Flexbox horizontal gap={8}>
          <Button icon={<Icon icon={MessageCircleMore} />} shape="circle" onClick={() => message.info('Lyrics action ready')} />
          <Button icon={<Icon icon={Download} />} shape="circle" onClick={() => audioUrl && downloadFile(audioUrl, `${safeName(title)}.mp3`, false)} />
          <Button icon={<Icon icon={Share2} />} shape="circle" onClick={() => setShareOpen(true)} />
          <Button icon={<Icon icon={Expand} />} shape="circle" onClick={() => setFullOpen(true)} />
          <Dropdown menu={{ items: [
            { key: 'extend', label: 'Extend' },
            { key: 'remix', label: 'Remix / mashup' },
            { key: 'addVocals', label: 'Add vocals' },
            { key: 'instrumental', label: 'Add instrumental' },
            { key: 'replace', label: 'Replace section' },
            { key: 'boost', label: 'Boost style' },
            { key: 'cover', label: 'Album art' },
          ], onClick: ({ key }) => { setEditAction(String(key)); setEditOpen(true); } }} trigger={['click']}>
            <Button icon={<Icon icon={MoreVertical} />} shape="circle" />
          </Dropdown>
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal align="center" gap={8} style={{ bottom: 12, left: 12, position: 'absolute', right: 12 }}>
        <Text fontSize={12}>{Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, '0')}</Text>
        <Slider style={{ flex: 1, margin: 0 }} tooltip={{ open: false }} value={progress} onChange={(value) => { if (audioRef.current && duration) audioRef.current.currentTime = (value / 100) * duration; }} />
      </Flexbox>
      <Modal centered footer={null} open={shareOpen} title="Share this track" onCancel={() => setShareOpen(false)}>
        <Flexbox gap={10}><Input readOnly value={audioUrl || ''} /><Button onClick={() => audioUrl && navigator.clipboard.writeText(audioUrl)}>Copy link</Button></Flexbox>
      </Modal>
      <Modal centered footer={null} open={fullOpen} width={720} onCancel={() => setFullOpen(false)}>
        <Flexbox gap={12}>{artUrl && <img alt={title} src={artUrl} style={{ borderRadius: 12, width: '100%' }} />}<Text>{title}</Text></Flexbox>
      </Modal>
      <Modal centered open={editOpen} okText="Start" title="Edit track" onCancel={() => setEditOpen(false)} onOk={runEdit}>
        <Flexbox gap={12}>
          <Select value={editAction} options={[{ label: 'Extend', value: 'extend' }, { label: 'Remix / mashup', value: 'remix' }, { label: 'Add vocals', value: 'addVocals' }, { label: 'Add instrumental', value: 'instrumental' }, { label: 'Replace section', value: 'replace' }, { label: 'Boost style', value: 'boost' }, { label: 'Album art', value: 'cover' }]} onChange={setEditAction} />
          <Input.TextArea autoSize={{ maxRows: 5, minRows: 3 }} placeholder="Prompt or edit direction" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} />
        </Flexbox>
      </Modal>
    </Block>
  );
});

const Batch = memo<{ batch: GenerationBatch }>(({ batch }) => (
  <Block gap={8} variant="borderless">
    <Markdown variant="chat">{batch.prompt}</Markdown>
    <Grid maxItemWidth={360} rows={batch.generations.length}>
      {batch.generations.map((generation, index) => <Tile batch={batch} generation={generation} index={index} key={generation.id} />)}
    </Grid>
    <Text fontSize={12} type="secondary">{batch.generations.length} tracks</Text>
  </Block>
));

const AlbumWorkspace = memo(() => {
  const topicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore(audioGenerationBatchSelectors.currentGenerationBatches);
  if (!topicId || !batches.length) return null;
  return <Flexbox gap={18} style={{ marginInline: 'auto', maxWidth: 760, width: '100%' }}>{batches.map((batch) => <Batch batch={batch} key={batch.id} />)}</Flexbox>;
});

AlbumWorkspace.displayName = 'AlbumWorkspace';
export default AlbumWorkspace;
