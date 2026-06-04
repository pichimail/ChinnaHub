'use client';

import { Button, Flexbox, Icon } from '@lobehub/ui';
import { Input, Modal, Segmented, Select, Slider, Switch } from 'antd';
import { Dice5, FileText, Mic2, SlidersHorizontal } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { loginRequired } from '@/components/Error/loginRequiredNotification';
import { useIsDark } from '@/hooks/useIsDark';
import { GenerationMediaModeSegment, GenerationPromptAssistantAction, GenerationPromptInput, InlineImageReference } from '@/routes/(main)/(create)/features/GenerationInput';
import { audioConversationSelectors, audioGenerationConfigSelectors, createAudioSelectors, useAudioStore } from '@/store/audio';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import VoicePersonaModal from '../VoicePersonaModal';

type Mode = 'simple' | 'advanced';
const LIMIT = { prompt: 500, lyrics: 5000, style: 1000, negative: 200 };
const styleOptions = ['Pop', 'Rock', 'Jazz', 'Classical', 'Electronic', 'Hip Hop', 'R&B', 'Country', 'Folk', 'Ambient'].map((v) => ({ label: v, value: v.toLowerCase().replaceAll(' ', '-') }));
const seeds = [
  ['Create a cinematic Telugu-English love song with warm male vocals, emotional strings, soft tabla, modern pop drums, and a hopeful chorus.', 'cinematic pop, Telugu-English fusion', 'muddy mix, flat hook, harsh highs', 28, 84, 'Heartline'],
  ['Generate an energetic festival dance track with punchy drums, catchy hook, bright synths, Indian percussion, and crowd-ready drops.', 'festival dance, Indian percussion', 'slow intro, weak bass, dull drop', 58, 88, 'Neon Jathara'],
  ['Make a late-night lo-fi romantic track with soft piano, rain texture, relaxed beat, airy vocals, and a memorable humming hook.', 'lo-fi romance, soft piano', 'busy drums, harsh tuning, noisy ambience', 36, 76, 'Rain Notes'],
] as const;
const negativeFromStyle = (style?: string) => {
  const s = style?.toLowerCase() || '';
  const tags = ['low quality', 'muddy mix', 'off key vocals'];
  if (s.includes('dance')) tags.push('weak drop');
  if (s.includes('cinematic')) tags.push('thin strings');
  if (s.includes('rock')) tags.push('muddy guitars');
  return [...new Set(tags)].join(', ').slice(0, LIMIT.negative);
};

const LeanPromptInput = memo(() => {
  const { t } = useTranslation('audio');
  const isDarkMode = useIsDark();
  const isLogin = useUserStore(authSelectors.isLogin);
  const parameters = useAudioStore(audioGenerationConfigSelectors.parameters);
  const isInit = useAudioStore(audioGenerationConfigSelectors.isInit);
  const isCreating = useAudioStore(createAudioSelectors.isCreating);
  const lastTrack = useAudioStore(audioConversationSelectors.lastTrack);
  const [mode, setMode] = useState<Mode>('simple');
  const [open, setOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const store = useAudioStore();

  useEffect(() => { if (!isInit) store.initializeAudioConfig(); }, [isInit, store]);
  const max = mode === 'advanced' ? LIMIT.lyrics : LIMIT.prompt;
  const refs = useMemo(() => (parameters.imageUrl ? [parameters.imageUrl] : []), [parameters.imageUrl]);

  const setPrompt = useCallback((v: string) => store.setAudioPrompt(v.slice(0, max)), [max, store]);
  const setStyle = (v?: string) => { store.setAudioStyle(v?.slice(0, LIMIT.style)); if (v) store.setAudioNegativeTags(negativeFromStyle(v)); };
  const surprise = () => { const s = seeds[Math.floor(Math.random() * seeds.length)]; store.setAudioPrompt(s[0].slice(0, max)); store.setAudioStyle(s[1]); store.setAudioNegativeTags(s[2]); store.setAudioWeirdness(s[3]); store.setAudioStyleInfluence(s[4]); store.setAudioTitle(s[5]); };

  const generate = async () => {
    if (!isLogin) return loginRequired.redirect({ timeout: 2000 });
    const prompt = parameters.prompt?.trim() || '';
    if (mode === 'simple' && prompt.length > LIMIT.prompt) return message.warning('Simple prompt must stay under 500 characters.');
    if (mode === 'advanced' && prompt.length > LIMIT.lyrics) return message.warning('Lyrics description must stay under 5000 characters.');
    if ((parameters.style?.length || 0) > LIMIT.style) return message.warning('Music styles must stay under 1000 characters.');
    if ((parameters.negativeTags?.length || 0) > LIMIT.negative) return message.warning('Negative tags must stay under 200 characters.');
    const hasContext = Boolean(lastTrack?.generationId);
    const finalPrompt = hasContext ? [`Previous track: ${lastTrack?.title || 'last generated track'}`, lastTrack?.prompt ? `Original request: ${lastTrack.prompt}` : undefined, `Follow-up request: ${prompt}`].filter(Boolean).join('\n') : prompt;
    if (prompt) {
      store.appendAudioMessage({ content: prompt, intent: hasContext ? 'followUp' : 'generate', role: 'user', trackContext: hasContext ? lastTrack : undefined });
      store.appendAudioMessage({ content: hasContext ? 'Creating the next version.' : 'Creating two Accoustica tracks.', intent: hasContext ? 'followUp' : 'generate', role: 'assistant', trackContext: hasContext ? lastTrack : undefined });
    }
    if (finalPrompt && finalPrompt !== prompt) store.setAudioPrompt(finalPrompt);
    await store.createAudio();
  };

  return <>
    <GenerationPromptInput canGenerate={Boolean(parameters.prompt?.trim()) || refs.length > 0} disableGenerate={!isInit} generateLabel={t('generation.generate')} generatingLabel={t('generation.generating')} inlineContent={<InlineImageReference images={refs} maxCount={1} onAdd={(d) => store.setAudioImageUrl(typeof d === 'string' ? d : d.url)} onRemove={() => store.setAudioImageUrl(undefined)} />} isCreating={isCreating} isDarkMode={isDarkMode} leftActions={<GenerationMediaModeSegment mode="audio" />} placeholder={mode === 'advanced' ? 'Write lyrics or describe the song structure' : 'Describe your song'} rightActions={<Flexbox horizontal align="center" gap={6}><Button icon={<Icon icon={Mic2} />} size="small" title="Voice" type="text" onClick={() => setVoiceOpen(true)} /><Button icon={<Icon icon={FileText} />} size="small" title="Lyrics" type={mode === 'advanced' ? 'primary' : 'text'} onClick={() => { setMode('advanced'); setOpen(true); }} /><Button icon={<Icon icon={SlidersHorizontal} />} size="small" title="Settings" type="text" onClick={() => setOpen(true)} /><GenerationPromptAssistantAction imageUrls={refs} mode="audio" prompt={parameters.prompt} onPromptChange={setPrompt} /></Flexbox>} value={parameters.prompt || ''} onGenerate={generate} onValueChange={setPrompt} />
    <Modal centered destroyOnHidden footer={null} open={open} title="Accoustica settings" width={560} onCancel={() => setOpen(false)}>
      <Flexbox gap={14}>
        <Segmented block options={[{ label: 'Simple', value: 'simple' }, { label: 'Advanced', value: 'advanced' }]} value={mode} onChange={(v) => setMode(v as Mode)} />
        <Select allowClear options={styleOptions} placeholder="Style" value={parameters.style || undefined} onChange={setStyle} />
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={LIMIT.style} placeholder="Music styles" value={parameters.style || ''} onChange={(e) => setStyle(e.target.value)} />
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} maxLength={LIMIT.negative} placeholder="Negative tags" value={parameters.negativeTags || ''} onChange={(e) => store.setAudioNegativeTags(e.target.value.slice(0, LIMIT.negative))} />
        <div>Weirdness: {parameters.weirdness || 1}<Slider max={100} min={1} value={parameters.weirdness || 1} onChange={store.setAudioWeirdness} /></div>
        <div>Style influence: {parameters.audioStyleInfluence || 1}<Slider max={100} min={1} value={parameters.audioStyleInfluence || 1} onChange={store.setAudioStyleInfluence} /></div>
        <Input placeholder="Title" value={parameters.title || ''} onChange={(e) => store.setAudioTitle(e.target.value)} />
        <Input placeholder="Artist" value={parameters.artist || ''} onChange={(e) => store.setAudioArtist(e.target.value)} />
        <Flexbox horizontal align="center" justify="space-between"><span>Instrumental</span><Switch checked={!!parameters.makeInstrumental} onChange={store.setMakeInstrumental} /></Flexbox>
        <Flexbox horizontal gap={8}><Select style={{ flex: 1 }} options={[{ label: 'Accoustica', value: 'classic' }, { label: 'Lyria', value: 'lyria' }]} value={parameters.providerMode || 'classic'} onChange={(v) => store.setAudioProviderMode(v as 'classic' | 'lyria')} /><Select style={{ width: 120 }} options={[{ label: 'V1.0', value: 'V1.0' }, { label: 'V2.0', value: 'V2.0' }, { label: 'V3.0', value: 'V3.0' }]} value={parameters.modelVersion || 'V3.0'} onChange={(v) => store.setAudioModelVersion(v as 'V1.0' | 'V2.0' | 'V3.0')} /></Flexbox>
        <Button block icon={<Icon icon={Dice5} />} onClick={surprise}>Surprise me</Button>
      </Flexbox>
    </Modal>
    <VoicePersonaModal open={voiceOpen} onClose={() => setVoiceOpen(false)} />
  </>;
});

LeanPromptInput.displayName = 'LeanPromptInput';
export default LeanPromptInput;
