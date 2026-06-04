'use client';

import { AsyncTaskStatus } from '@lobechat/types';
import { Block, Button, Flexbox, Grid, Icon, Markdown, Text } from '@lobehub/ui';
import { App, Dropdown, Input, Modal, Slider } from 'antd';
import { createStaticStyles, keyframes } from 'antd-style';
import { Download, Expand, MessageCircleMore, MoreVertical, Pause, Play, Share2, Volume2, VolumeX } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { audioService } from '@/services/audio';
import { audioActionService } from '@/services/audioAction';
import { audioGenerationBatchSelectors, audioGenerationTopicSelectors, useAudioStore } from '@/store/audio';
import { type AudioGenerationAsset, type Generation, type GenerationBatch } from '@/types/generation';
import { downloadFile } from '@/utils/client/downloadFile';

const shimmer = keyframes`0%{opacity:1}50%{opacity:.35}100%{opacity:1}`;

const styles = createStaticStyles(({ css, cssVar }) => ({
  album: css`position:relative;overflow:hidden;width:100%;aspect-ratio:1;border-radius:${cssVar.borderRadiusLG}px;background:${cssVar.colorFillSecondary};&:hover .audio-actions{opacity:1}`,
  actions: css`position:absolute;z-index:3;inset-block-start:12px;inset-inline:12px;display:flex;justify-content:space-between;opacity:0;transition:opacity .12s ${cssVar.motionEaseInOut};@media(max-width:768px){opacity:1}`,
  artwork: css`width:100%;height:100%;object-fit:cover`,
  controls: css`position:absolute;z-index:3;inset-block-end:12px;inset-inline:12px;display:flex;gap:10px;align-items:center;opacity:0;transition:opacity .12s ${cssVar.motionEaseInOut};@media(max-width:768px){opacity:1}`,
  loading: css`&::before{content:'';position:absolute;inset:0;background:${cssVar.colorFillSecondary};animation:${shimmer} 1.8s linear infinite}`,
  roundButton: css`border:1px solid ${cssVar.colorBorderSecondary};background:rgb(0 0 0 / 42%);backdrop-filter:blur(12px)`,
  volume: css`position:absolute;z-index:4;inset-block-start:62px;inset-inline-end:14px;padding:8px 2px;border-radius:999px;background:rgb(0 0 0 / 42%);backdrop-filter:blur(12px);opacity:0;.audio-album:hover &{opacity:1}@media(max-width:768px){opacity:1}`,
}));

const getArt = (asset?: AudioGenerationAsset | null) => {
  const anyAsset = asset as any;
  return anyAsset?.coverUrl || anyAsset?.imageUrl || anyAsset?.thumbnailUrl || anyAsset?.coverImageUrl;
};
const getAudio = (asset?: AudioGenerationAsset | null) => asset?.url || asset?.originalUrl;
const safeName = (value: string) => value.replaceAll(/["%*/:<>?\\|]/g, '').replaceAll(/\s+/g, '_');

const AudioTile = memo<{ batch: GenerationBatch; generation: Generation; index: number }>(({ batch, generation, index }) => {
  const { message } = App.useApp();
  const { t } = useTranslation('audio');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [shareOpen, setShareOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editAction, setEditAction] = useState('extend');
  const [editPrompt, setEditPrompt] = useState('');

  const asset = generation.asset as AudioGenerationAsset | null | undefined;
  const audioUrl = getAudio(asset);
  const artUrl = getArt(asset);
  const title = (asset as any)?.title || (batch.config as any)?.title || `Track ${index + 1}`;
  const taskId = (asset as any)?.taskId || (asset as any)?.parentTaskId || (batch.config as any)?.taskId;
  const audioId = (asset as any)?.audioId || generation.id;
  const isReady = Boolean(audioUrl);
  const isLoading = generation.task.status === AsyncTaskStatus.Processing || generation.task.status === AsyncTaskStatus.Pending;

  const play = async () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); return; }
    await audioRef.current.play(); setPlaying(true);
  };

  const download = useCallback(async () => { if (!audioUrl) return; await downloadFile(audioUrl, `${safeName(title)}.mp3`, false); message.success(t('generation.download')); }, [audioUrl, message, t, title]);
  const loadLyrics = useCallback(async () => { try { await audioService.getTimestampedLyrics(generation.id); message.success(t('generation.lyricsReady')); } catch { message.error(t('generation.failed')); } }, [generation.id, message, t]);

  const callEdit = async () => {
    const payload = { audioId, taskId, prompt: editPrompt || batch.prompt };
    try {
      if (editAction === 'extend') await audioActionService.extendMusic(payload);
      if (editAction === 'remix') await audioActionService.generateMashup(payload);
      if (editAction === 'addVocals') await audioActionService.addVocals(payload);
      if (editAction === 'instrumental') await audioActionService.addInstrumental(payload);
      if (editAction === 'replace') await audioActionService.replaceSection({ ...payload, startTime: 0, endTime: 30 });
      if (editAction === 'boost') await audioActionService.boostStyle({ prompt: editPrompt || batch.prompt });
      if (editAction === 'cover') await audioActionService.generateMusicCover({ taskId, prompt: editPrompt });
      message.success('Action started');
      setEditOpen(false);
    } catch (error) { message.error(error instanceof Error ? error.message : 'Action failed'); }
  };

  const shareUrl = audioUrl || globalThis.location?.href || '';
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;

  return <Block className={`${styles.album} audio-album ${isLoading ? styles.loading : ''}`} variant="filled">
    {artUrl ? <img alt={title} className={styles.artwork} src={artUrl} /> : null}
    {!artUrl && !isLoading ? <Flexbox align="center" justify="center" height="100%"><Icon icon={Play} size={42} /></Flexbox> : null}
    {isLoading ? <Flexbox align="center" justify="center" height="100%" style={{ position: 'relative', zIndex: 2 }}><NeuralNetworkLoading size={44} /></Flexbox> : null}
    {isReady && <audio ref={audioRef} src={audioUrl} onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)} onEnded={() => setPlaying(false)} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime || 0)} />}
    <div className={`${styles.actions} audio-actions`}>
      <Button className={styles.roundButton} icon={<Icon icon={playing ? Pause : Play} />} shape="circle" onClick={play} />
      <Flexbox horizontal gap={8}>
        <Button className={styles.roundButton} icon={<Icon icon={MessageCircleMore} />} shape="circle" onClick={loadLyrics} />
        <Button className={styles.roundButton} icon={<Icon icon={Download} />} shape="circle" onClick={download} />
        <Button className={styles.roundButton} icon={<Icon icon={Share2} />} shape="circle" onClick={() => setShareOpen(true)} />
        <Button className={styles.roundButton} icon={<Icon icon={Expand} />} shape="circle" onClick={() => setFullOpen(true)} />
        <Dropdown menu={{ items: [
          { key: 'extend', label: 'Extend' }, { key: 'remix', label: 'Remix / mashup' }, { key: 'addVocals', label: 'Add vocals' }, { key: 'instrumental', label: 'Add instrumental' }, { key: 'replace', label: 'Replace section' }, { key: 'boost', label: 'Boost style' }, { key: 'cover', label: 'Album art' },
        ], onClick: ({ key }) => { setEditAction(String(key)); setEditOpen(true); } }} trigger={['click']}><Button className={styles.roundButton} icon={<Icon icon={MoreVertical} />} shape="circle" /></Dropdown>
      </Flexbox>
    </div>
    <div className={styles.controls}><Text fontSize={12} style={{ minWidth: 36 }}>{Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, '0')}</Text><Slider style={{ flex: 1, margin: 0 }} tooltip={{ open: false }} value={progress} onChange={(value) => { if (audioRef.current && duration) audioRef.current.currentTime = (value / 100) * duration; }} /></div>
    <div className={styles.volume}><Icon icon={volume > 0 ? Volume2 : VolumeX} size={14} /><Slider vertical max={1} min={0} step={0.01} tooltip={{ open: false }} value={volume} onChange={(value) => { setVolume(value); if (audioRef.current) audioRef.current.volume = value; }} /></div>
    <Modal centered footer={null} open={shareOpen} title="Share this track" onCancel={() => setShareOpen(false)}><Flexbox gap={12}><InputLike value={shareUrl} /><Flexbox horizontal gap={10} style={{ flexWrap: 'wrap' }}><Button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy link</Button><Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`)}>WhatsApp</Button><Button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)}>Facebook</Button><Button onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`)}>X</Button><Button onClick={() => navigator.share?.({ title, url: shareUrl })}>Contacts</Button></Flexbox></Flexbox></Modal>
    <Modal centered footer={null} open={fullOpen} width={720} onCancel={() => setFullOpen(false)}><Flexbox gap={12}><Block className={styles.album} variant="filled">{artUrl ? <img alt={title} className={styles.artwork} src={artUrl} /> : null}</Block><Text>{title}</Text></Flexbox></Modal>
    <Modal centered open={editOpen} title="Edit track" okText="Start" onCancel={() => setEditOpen(false)} onOk={callEdit}><Flexbox gap={12}><Select value={editAction} options={[{ label: 'Extend', value: 'extend' }, { label: 'Remix / mashup', value: 'remix' }, { label: 'Add vocals', value: 'addVocals' }, { label: 'Add instrumental', value: 'instrumental' }, { label: 'Replace section', value: 'replace' }, { label: 'Boost style', value: 'boost' }, { label: 'Album art', value: 'cover' }]} onChange={setEditAction} /><Input.TextArea autoSize={{ minRows: 3, maxRows: 5 }} placeholder="Prompt or edit direction" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} /></Flexbox></Modal>
  </Block>;
});

const InputLike = ({ value }: { value: string }) => <Block padding={12} variant="filled"><Text copyable={{ text: value }} ellipsis>{value}</Text></Block>;
const BatchItem = memo<{ batch: GenerationBatch }>(({ batch }) => <Block gap={8} variant="borderless"><Markdown variant="chat">{batch.prompt}</Markdown><Grid maxItemWidth={360} rows={batch.generations.length}>{batch.generations.map((generation, index) => <AudioTile batch={batch} generation={generation} index={index} key={generation.id} />)}</Grid><Text fontSize={12} type="secondary">{batch.generations.length} tracks</Text></Block>);

const ImageStyleAudioWorkspace = memo(() => {
  const topicId = useAudioStore(audioGenerationTopicSelectors.activeGenerationTopicId);
  const batches = useAudioStore(audioGenerationBatchSelectors.currentGenerationBatches);
  if (!topicId || !batches?.length) return null;
  return <Flexbox gap={18} style={{ marginInline: 'auto', maxWidth: 760, width: '100%' }}>{batches.map((batch) => <BatchItem batch={batch} key={batch.id} />)}</Flexbox>;
});

ImageStyleAudioWorkspace.displayName = 'ImageStyleAudioWorkspace';
export default ImageStyleAudioWorkspace;
