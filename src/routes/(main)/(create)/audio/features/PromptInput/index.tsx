'use client';

import { Button, Flexbox, Icon, Segmented, Text } from '@lobehub/ui';
import { Collapse, Input, Select, Slider, Switch } from 'antd';
import { Dice5, Music2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { message } from '@/components/AntdStaticMethods';
import { loginRequired } from '@/components/Error/loginRequiredNotification';
import Action from '@/features/ChatInput/ActionBar/components/Action';
import { useIsDark } from '@/hooks/useIsDark';
import {
  GenerationMediaModeSegment,
  GenerationPromptAssistantAction,
  GenerationPromptInput,
  InlineImageReference,
} from '@/routes/(main)/(create)/features/GenerationInput';
import { audioGenerationConfigSelectors, createAudioSelectors, useAudioStore } from '@/store/audio';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/slices/auth/selectors';

import PromptTitle from './Title';

interface PromptInputProps {
  disableAnimation?: boolean;
  showTitle?: boolean;
}

type AudioComposerMode = 'simple' | 'advanced';

type PromptSeed = {
  audioStyleInfluence: number;
  negativeTags: string;
  prompt: string;
  style: string;
  title: string;
  weirdness: number;
};

const SIMPLE_PROMPT_LIMIT = 500;
const ADVANCED_LYRICS_LIMIT = 5000;
const ADVANCED_STYLE_LIMIT = 1000;
const NEGATIVE_TAG_LIMIT = 200;

const styleOptions = [
  'Pop',
  'Rock',
  'Jazz',
  'Classical',
  'Electronic',
  'Hip Hop',
  'R&B',
  'Country',
  'Folk',
  'Ambient',
].map((style) => ({ label: style, value: style.toLowerCase().replaceAll(' ', '-') }));

const promptSeeds: PromptSeed[] = [
  {
    audioStyleInfluence: 84,
    negativeTags: 'muddy mix, flat hook, harsh highs, robotic vocals, weak drums',
    prompt:
      'Create a cinematic Telugu-English love song with warm male vocals, emotional strings, soft tabla, modern pop drums, and a hopeful chorus.',
    style: 'cinematic pop, Telugu-English fusion, warm vocals, emotional strings',
    title: 'Heartline',
    weirdness: 28,
  },
  {
    audioStyleInfluence: 88,
    negativeTags: 'slow intro, dull drop, weak bass, thin percussion, off beat groove',
    prompt:
      'Generate an energetic festival dance track with punchy drums, catchy hook, bright synths, Indian percussion, and crowd-ready drops.',
    style: 'festival dance, Indian percussion, EDM pop, bright synths',
    title: 'Neon Jathara',
    weirdness: 58,
  },
  {
    audioStyleInfluence: 76,
    negativeTags: 'busy drums, harsh vocal tuning, noisy ambience, distorted piano',
    prompt:
      'Make a late-night lo-fi romantic track with soft piano, rain texture, relaxed beat, airy vocals, and a memorable humming hook.',
    style: 'lo-fi romance, soft piano, rain ambience, airy vocals',
    title: 'Rain Notes',
    weirdness: 36,
  },
  {
    audioStyleInfluence: 82,
    negativeTags: 'generic melody, muddy bass, cluttered mix, flat vocal energy',
    prompt:
      'Produce a confident tech-founder anthem with futuristic synth bass, crisp trap drums, motivational vocals, and a premium cinematic build.',
    style: 'futuristic trap, cinematic synthwave, motivational vocal hook',
    title: 'Build Mode',
    weirdness: 64,
  },
];

const buildNegativeTagsFromStyle = (style?: string): string => {
  const normalized = style?.toLowerCase() || '';
  const tags = ['low quality', 'muddy mix', 'off key vocals'];

  if (normalized.includes('lo-fi')) tags.push('overcompressed drums', 'harsh hiss');
  if (normalized.includes('cinematic')) tags.push('thin strings', 'weak climax');
  if (normalized.includes('dance') || normalized.includes('edm')) tags.push('weak drop', 'flat bass');
  if (normalized.includes('rock') || normalized.includes('metal')) tags.push('muddy guitars', 'buried vocals');
  if (normalized.includes('folk')) tags.push('synthetic acoustic tone', 'rushed rhythm');

  return Array.from(new Set(tags)).join(', ').slice(0, NEGATIVE_TAG_LIMIT);
};

const PromptInput = memo<PromptInputProps>(({ showTitle = false }) => {
  const isDarkMode = useIsDark();
  const { t } = useTranslation('audio');
  const parameters = useAudioStore(audioGenerationConfigSelectors.parameters);
  const isInit = useAudioStore(audioGenerationConfigSelectors.isInit);
  const isCreating = useAudioStore(createAudioSelectors.isCreating);
  const isLogin = useUserStore(authSelectors.isLogin);
  const username = useUserStore(userProfileSelectors.username);
  const hasSetDefaultArtist = useRef(false);
  const [composerMode, setComposerMode] = useState<AudioComposerMode>('simple');
  const {
    createAudio,
    initializeAudioConfig,
    setAudioArtist,
    setAudioImageUrl,
    setAudioModelVersion,
    setAudioNegativeTags,
    setAudioPrompt,
    setAudioProviderMode,
    setAudioStyle,
    setAudioStyleInfluence,
    setAudioTitle,
    setAudioWeirdness,
    setMakeInstrumental,
  } = useAudioStore();

  useEffect(() => {
    if (!isInit) initializeAudioConfig();
  }, [initializeAudioConfig, isInit]);

  useEffect(() => {
    if (hasSetDefaultArtist.current) return;

    if (username && username !== 'anonymous' && !parameters.artist) {
      setAudioArtist(username);
      hasSetDefaultArtist.current = true;
    }
  }, [parameters.artist, setAudioArtist, username]);

  const promptLimit = composerMode === 'simple' ? SIMPLE_PROMPT_LIMIT : ADVANCED_LYRICS_LIMIT;
  const promptLength = parameters.prompt?.length || 0;
  const styleLength = parameters.style?.length || 0;
  const negativeTagLength = parameters.negativeTags?.length || 0;

  const handlePromptChange = useCallback(
    (value: string) => {
      setAudioPrompt(value.slice(0, promptLimit));
    },
    [promptLimit, setAudioPrompt],
  );

  const handleStyleChange = useCallback(
    (value?: string) => {
      const nextStyle = value ? value.slice(0, ADVANCED_STYLE_LIMIT) : value;
      setAudioStyle(nextStyle);
      if (nextStyle) setAudioNegativeTags(buildNegativeTagsFromStyle(nextStyle));
    },
    [setAudioNegativeTags, setAudioStyle],
  );

  const handleNegativeTagsChange = useCallback(
    (value?: string) => {
      setAudioNegativeTags(value ? value.slice(0, NEGATIVE_TAG_LIMIT) : value);
    },
    [setAudioNegativeTags],
  );

  const handleSurpriseMe = useCallback(() => {
    const seed = promptSeeds[Math.floor(Math.random() * promptSeeds.length)];
    setAudioPrompt(seed.prompt.slice(0, promptLimit));
    setAudioStyle(seed.style.slice(0, ADVANCED_STYLE_LIMIT));
    setAudioNegativeTags(seed.negativeTags.slice(0, NEGATIVE_TAG_LIMIT));
    setAudioStyleInfluence(seed.audioStyleInfluence);
    setAudioTitle(seed.title);
    setAudioWeirdness(seed.weirdness);
  }, [
    promptLimit,
    setAudioNegativeTags,
    setAudioPrompt,
    setAudioStyle,
    setAudioStyleInfluence,
    setAudioTitle,
    setAudioWeirdness,
  ]);

  const handleGenerate = async () => {
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }

    if (composerMode === 'simple' && promptLength > SIMPLE_PROMPT_LIMIT) {
      message.warning('Simple mode prompt must stay under 500 characters.');
      return;
    }

    if (composerMode === 'advanced' && styleLength > ADVANCED_STYLE_LIMIT) {
      message.warning('Music style must stay under 1000 characters.');
      return;
    }

    if (negativeTagLength > NEGATIVE_TAG_LIMIT) {
      message.warning('Negative tags must stay under 200 characters.');
      return;
    }

    await createAudio();
  };

  const imagePreviewUrls = useMemo(
    () => (parameters.imageUrl ? [parameters.imageUrl] : []),
    [parameters.imageUrl],
  );

  const handleAddImage = useCallback(
    (data: string | { dimensions?: { height: number; width: number }; url: string }) => {
      const url = typeof data === 'string' ? data : data?.url;
      if (!url) return;

      setAudioImageUrl(url);
    },
    [setAudioImageUrl],
  );

  const handleRemoveImage = useCallback(() => {
    setAudioImageUrl(undefined);
  }, [setAudioImageUrl]);

  const composerHeader = (
    <Flexbox gap={10} padding={8}>
      <Flexbox horizontal align="center" gap={12} justify="space-between" style={{ flexWrap: 'wrap' }}>
        <Flexbox gap={2} style={{ minWidth: 240 }}>
          <Text weight={700}>Accoustica music chat</Text>
          <Text fontSize={12} type="secondary">
            Describe the song. Accoustica auto-fills production guardrails and generates two tracks.
          </Text>
        </Flexbox>
        <Segmented
          value={composerMode}
          variant="filled"
          options={[
            { label: 'Simple', value: 'simple' },
            { label: 'Advanced', value: 'advanced' },
          ]}
          onChange={(value) => setComposerMode(value as AudioComposerMode)}
        />
      </Flexbox>
      <Flexbox horizontal align="center" gap={8} justify="space-between" style={{ flexWrap: 'wrap' }}>
        <Text fontSize={12} type={promptLength > promptLimit ? 'danger' : 'secondary'}>
          {composerMode === 'simple'
            ? `${promptLength}/${SIMPLE_PROMPT_LIMIT} prompt characters`
            : `${promptLength}/${ADVANCED_LYRICS_LIMIT} lyrics description characters`}
        </Text>
        <Text fontSize={12} type={negativeTagLength > NEGATIVE_TAG_LIMIT ? 'danger' : 'secondary'}>
          {negativeTagLength}/{NEGATIVE_TAG_LIMIT} negative tags · two songs per request
        </Text>
      </Flexbox>
    </Flexbox>
  );

  return (
    <Flexbox gap={32} width={'100%'}>
      {showTitle && <PromptTitle />}
      <GenerationPromptInput
        canGenerate={Boolean(parameters.prompt?.trim()) || imagePreviewUrls.length > 0}
        disableGenerate={!isInit}
        generateLabel={t('generation.generate')}
        generatingLabel={t('generation.generating', { defaultValue: 'Generating audio...' })}
        header={composerHeader}
        isCreating={isCreating}
        isDarkMode={isDarkMode}
        placeholder={
          composerMode === 'simple'
            ? 'Describe the song in natural language. Keep it under 500 characters.'
            : 'Write lyrics, song story, structure, vocal direction, sections, and mood. Max 5000 characters.'
        }
        value={parameters.prompt || ''}
        inlineContent={
          <InlineImageReference
            images={imagePreviewUrls}
            maxCount={1}
            onAdd={handleAddImage}
            onRemove={handleRemoveImage}
          />
        }
        leftActions={
          <Flexbox horizontal align={'center'} gap={4}>
            <GenerationMediaModeSegment mode={'audio'} />
            <Action
              icon={Music2}
              title={t('generation.settings')}
              trigger={'click'}
              popover={{
                content: (
                  <Flexbox gap={12} style={{ minWidth: 300 }}>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>{t('generation.modelVersion')}</Text>
                      <Segmented
                        block
                        value={parameters.modelVersion || 'V3.0'}
                        variant="filled"
                        options={[
                          { label: 'V1.0', value: 'V1.0' },
                          { label: 'V2.0', value: 'V2.0' },
                          { label: 'V3.0', value: 'V3.0' },
                        ]}
                        onChange={(value) =>
                          setAudioModelVersion(value as 'V1.0' | 'V2.0' | 'V3.0')
                        }
                      />
                    </Flexbox>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>{t('generation.providerMode')}</Text>
                      <Select
                        value={parameters.providerMode || 'classic'}
                        options={[
                          { label: t('generation.providerMode.classic'), value: 'classic' },
                          { label: t('generation.providerMode.lyria'), value: 'lyria' },
                        ]}
                        onChange={(value) => setAudioProviderMode(value as 'classic' | 'lyria')}
                      />
                    </Flexbox>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>{t('generation.style')}</Text>
                      <Select
                        allowClear
                        options={styleOptions}
                        placeholder={t('generation.selectStyle')}
                        value={parameters.style || undefined}
                        onChange={(value) => handleStyleChange(value)}
                      />
                    </Flexbox>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>Music style boost</Text>
                      <Input.TextArea
                        autoSize={{ maxRows: 4, minRows: 2 }}
                        maxLength={ADVANCED_STYLE_LIMIT}
                        placeholder="Example: afro house, Telugu folk percussion, cinematic strings, male vocals, clean radio mix"
                        value={parameters.style || ''}
                        onChange={(event) => handleStyleChange(event.target.value)}
                      />
                    </Flexbox>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>Negative tags</Text>
                      <Input.TextArea
                        autoSize={{ maxRows: 3, minRows: 2 }}
                        maxLength={NEGATIVE_TAG_LIMIT}
                        placeholder="What to avoid in the song mix"
                        value={parameters.negativeTags || ''}
                        onChange={(event) => handleNegativeTagsChange(event.target.value)}
                      />
                    </Flexbox>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>Weirdness: {parameters.weirdness || 1}</Text>
                      <Slider
                        max={100}
                        min={1}
                        value={parameters.weirdness || 1}
                        onChange={(value) => setAudioWeirdness(value)}
                      />
                    </Flexbox>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>Audio style influence: {parameters.audioStyleInfluence || 1}</Text>
                      <Slider
                        max={100}
                        min={1}
                        value={parameters.audioStyleInfluence || 1}
                        onChange={(value) => setAudioStyleInfluence(value)}
                      />
                    </Flexbox>
                    <Collapse
                      bordered={false}
                      defaultActiveKey={[]}
                      items={[
                        {
                          children: (
                            <Flexbox gap={12} style={{ paddingTop: 4 }}>
                              <Flexbox gap={6}>
                                <Text fontSize={12}>{t('generation.title')}</Text>
                                <Input
                                  placeholder={t('generation.titlePlaceholder')}
                                  value={parameters.title || ''}
                                  onChange={(event) => setAudioTitle(event.target.value)}
                                />
                              </Flexbox>
                              <Flexbox gap={6}>
                                <Text fontSize={12}>{t('generation.artist')}</Text>
                                <Input
                                  placeholder={t('generation.artistPlaceholder')}
                                  value={parameters.artist || ''}
                                  onChange={(event) => setAudioArtist(event.target.value)}
                                />
                              </Flexbox>
                              <Flexbox horizontal align="center" justify="space-between">
                                <Text fontSize={12}>{t('generation.instrumental')}</Text>
                                <Switch
                                  checked={!!parameters.makeInstrumental}
                                  onChange={(checked) => setMakeInstrumental(checked)}
                                />
                              </Flexbox>
                            </Flexbox>
                          ),
                          key: 'manual-fields',
                          label: 'Manual fields',
                        },
                      ]}
                    />
                  </Flexbox>
                ),
                minWidth: 340,
                title: t('generation.settings'),
              }}
            />
          </Flexbox>
        }
        rightActions={
          <Flexbox horizontal align="center" gap={6}>
            <Button
              icon={<Icon icon={Dice5} />}
              shape="round"
              style={{
                background: 'linear-gradient(135deg, #6e8bff 0%, #47d9c6 100%)',
                border: 0,
                color: '#fff',
              }}
              title="Surprise me"
              onClick={handleSurpriseMe}
            >
              Surprise me
            </Button>
            <GenerationPromptAssistantAction
              imageUrls={imagePreviewUrls}
              mode={'audio'}
              prompt={parameters.prompt}
              onPromptChange={handlePromptChange}
            />
          </Flexbox>
        }
        onGenerate={handleGenerate}
        onValueChange={handlePromptChange}
      />
    </Flexbox>
  );
});

PromptInput.displayName = 'AudioPromptInput';

export { PromptInput };
export default PromptInput;
