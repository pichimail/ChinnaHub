'use client';

import { Button, Flexbox, Icon, Segmented, Text } from '@lobehub/ui';
import { Collapse, Input, Select, Switch } from 'antd';
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

const SIMPLE_PROMPT_LIMIT = 500;
const ADVANCED_LYRICS_LIMIT = 5000;
const ADVANCED_STYLE_LIMIT = 1000;

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

const promptSeeds = [
  {
    prompt:
      'Create a cinematic Telugu-English love song with warm male vocals, emotional strings, soft tabla, modern pop drums, and a hopeful chorus.',
    style: 'cinematic pop, Telugu-English fusion, warm vocals, emotional strings',
    title: 'Heartline',
  },
  {
    prompt:
      'Generate an energetic festival dance track with punchy drums, catchy hook, bright synths, Indian percussion, and crowd-ready drops.',
    style: 'festival dance, Indian percussion, EDM pop, bright synths',
    title: 'Neon Jathara',
  },
  {
    prompt:
      'Make a late-night lo-fi romantic track with soft piano, rain texture, relaxed beat, airy vocals, and a memorable humming hook.',
    style: 'lo-fi romance, soft piano, rain ambience, airy vocals',
    title: 'Rain Notes',
  },
  {
    prompt:
      'Produce a confident tech-founder anthem with futuristic synth bass, crisp trap drums, motivational vocals, and a premium cinematic build.',
    style: 'futuristic trap, cinematic synthwave, motivational vocal hook',
    title: 'Build Mode',
  },
];

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
    setAudioPrompt,
    setAudioProviderMode,
    setAudioStyle,
    setAudioTitle,
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

  const handlePromptChange = useCallback(
    (value: string) => {
      setAudioPrompt(value.slice(0, promptLimit));
    },
    [promptLimit, setAudioPrompt],
  );

  const handleStyleChange = useCallback(
    (value?: string) => {
      setAudioStyle(value ? value.slice(0, ADVANCED_STYLE_LIMIT) : value);
    },
    [setAudioStyle],
  );

  const handleSurpriseMe = useCallback(() => {
    const seed = promptSeeds[Math.floor(Math.random() * promptSeeds.length)];
    setAudioPrompt(seed.prompt.slice(0, promptLimit));
    setAudioStyle(seed.style.slice(0, ADVANCED_STYLE_LIMIT));
    setAudioTitle(seed.title);
  }, [promptLimit, setAudioPrompt, setAudioStyle, setAudioTitle]);

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
            Tell the AI the song you want. After generation, use the track actions to remix,
            extend, cover, split vocals, sync lyrics, or create visuals.
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
        <Text fontSize={12} type={styleLength > ADVANCED_STYLE_LIMIT ? 'danger' : 'secondary'}>
          {composerMode === 'advanced'
            ? `${styleLength}/${ADVANCED_STYLE_LIMIT} music style characters`
            : 'Shift + Enter for new line. Enter generates.'}
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
                  <Flexbox gap={12} style={{ minWidth: 280 }}>
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
                    <Collapse
                      bordered={false}
                      defaultActiveKey={[]}
                      items={[
                        {
                          children: (
                            <Flexbox gap={12} style={{ paddingTop: 4 }}>
                              <Text fontSize={12}>{t('generation.providerMode')}</Text>
                              <Select
                                value={parameters.providerMode || 'classic'}
                                options={[
                                  {
                                    label: t('generation.providerMode.classic'),
                                    value: 'classic',
                                  },
                                  {
                                    label: t('generation.providerMode.lyria'),
                                    value: 'lyria',
                                  },
                                ]}
                                onChange={(value) =>
                                  setAudioProviderMode(value as 'classic' | 'lyria')
                                }
                              />
                              <Text fontSize={11} type="secondary">
                                {t('generation.providerModeHint')}
                              </Text>
                            </Flexbox>
                          ),
                          key: 'advanced-provider',
                          label: t('generation.advanced'),
                        },
                      ]}
                    />
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
                    {composerMode === 'advanced' && (
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
                    )}
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
                minWidth: 320,
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
