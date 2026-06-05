'use client';

import { ModelIcon } from '@lobehub/icons';
import { ActionIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { Divider, Input, Segmented, Switch } from 'antd';
import { Music2Icon } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import Action from '@/features/ChatInput/ActionBar/components/Action';
import ModelSwitchPanel from '@/features/ModelSwitchPanel';
import { useIsDark } from '@/hooks/useIsDark';
import {
  ConfigAction,
  GenerationMediaModeSegment,
  GenerationPromptInput,
} from '@/routes/(main)/(create)/features/GenerationInput';
import AudioModelItem from '@/routes/(main)/(create)/audio/features/ConfigPanel/components/ModelSelect/AudioModelItem';
import { useAudioStore } from '@/store/audio';
import {
  CHINNA_AUDIO_MODEL,
  CHINNA_AUDIO_PROVIDER,
} from '@/store/audio/slices/generationConfig/initialState';
import { audioGenerationConfigSelectors } from '@/store/audio/slices/generationConfig/selectors';

import PromptTitle from './Title';

interface PromptInputProps {
  disableAnimation?: boolean;
  showTitle?: boolean;
}

const MAX_SIMPLE_PROMPT = 500;
const MAX_LYRICS = 5000;
const MAX_STYLE = 1000;

const enabledAudioModelList = [
  {
    children: [
      {
        abilities: { audio: true, imageOutput: false, video: false },
        displayName: 'Accoustica',
        id: CHINNA_AUDIO_MODEL,
        releasedAt: '2026-01-01',
      },
    ],
    id: CHINNA_AUDIO_PROVIDER,
    name: 'ChinnaHub',
  },
];

const getAudioModelIcon = (model?: string) => {
  if (!model || model === CHINNA_AUDIO_MODEL || model === 'accoustica') {
    return <Icon icon={Music2Icon} size={22} />;
  }

  return <ModelIcon model={model} size={22} />;
};

const AudioSettingsContent = memo(() => {
  const { t } = useTranslation('audio');
  const customMode = useAudioStore(audioGenerationConfigSelectors.customMode);
  const lyrics = useAudioStore(audioGenerationConfigSelectors.lyrics);
  const songTitle = useAudioStore(audioGenerationConfigSelectors.songTitle);
  const stylePrompt = useAudioStore(audioGenerationConfigSelectors.stylePrompt);
  const makeInstrumental = useAudioStore(audioGenerationConfigSelectors.makeInstrumental);
  const setCustomMode = useAudioStore((s) => s.setCustomMode);
  const setLyrics = useAudioStore((s) => s.setLyrics);
  const setSongTitle = useAudioStore((s) => s.setSongTitle);
  const setStylePrompt = useAudioStore((s) => s.setStylePrompt);
  const setMakeInstrumental = useAudioStore((s) => s.setMakeInstrumental);

  const modeOptions = useMemo(
    () => [
      { label: 'Simple', value: 'simple' },
      { label: 'Advanced', value: 'advanced' },
    ],
    [],
  );

  return (
    <Flexbox gap={12}>
      <Segmented
        block
        options={modeOptions}
        value={customMode ? 'advanced' : 'simple'}
        onChange={(value) => setCustomMode(value === 'advanced')}
      />
      <Flexbox gap={6}>
        <Text fontSize={12}>Title</Text>
        <Input
          maxLength={100}
          placeholder="Song title"
          value={songTitle}
          onChange={(e) => setSongTitle(e.target.value)}
        />
      </Flexbox>
      <Flexbox gap={6}>
        <Text fontSize={12}>Lyrics</Text>
        <Input.TextArea
          autoSize={{ maxRows: 8, minRows: 4 }}
          maxLength={MAX_LYRICS}
          placeholder="Write lyrics here for Accoustica advanced generation"
          showCount
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
        />
      </Flexbox>
      <Flexbox gap={6}>
        <Text fontSize={12}>Music style</Text>
        <Input.TextArea
          autoSize={{ maxRows: 4, minRows: 2 }}
          maxLength={MAX_STYLE}
          placeholder="Pop, cinematic, Telugu folk, lo-fi, energetic, soulful..."
          showCount
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
        />
      </Flexbox>
      <Divider style={{ marginBlock: 2 }} />
      <Flexbox horizontal align="center" justify="space-between" padding="0 2px">
        <Text weight={500}>{t('config.instrumental', { defaultValue: 'Instrumental' })}</Text>
        <Switch checked={makeInstrumental} onChange={setMakeInstrumental} />
      </Flexbox>
    </Flexbox>
  );
});

AudioSettingsContent.displayName = 'AudioSettingsContent';

const PromptInput = memo<PromptInputProps>(({ showTitle = false }) => {
  const isDarkMode = useIsDark();
  const { t } = useTranslation('audio');
  const prompt = useAudioStore(audioGenerationConfigSelectors.prompt);
  const lyrics = useAudioStore(audioGenerationConfigSelectors.lyrics);
  const customMode = useAudioStore(audioGenerationConfigSelectors.customMode);
  const currentModel = useAudioStore(audioGenerationConfigSelectors.model);
  const currentProvider = useAudioStore(audioGenerationConfigSelectors.provider);
  const isGenerating = useAudioStore((s) => s.isGenerating);
  const setPrompt = useAudioStore((s) => s.setPrompt);
  const setLyrics = useAudioStore((s) => s.setLyrics);
  const setModelAndProviderOnSelect = useAudioStore((s) => s.setModelAndProviderOnSelect);
  const generateAudio = useAudioStore((s) => s.generateAudio);

  const handleGenerate = useCallback(async () => {
    const value = customMode ? lyrics : prompt;
    if (!value.trim() || isGenerating) return;
    await generateAudio();
  }, [customMode, lyrics, prompt, isGenerating, generateAudio]);

  const inputValue = customMode ? lyrics : prompt;
  const setInputValue = customMode ? setLyrics : setPrompt;

  return (
    <Flexbox gap={32} width={'100%'}>
      {showTitle && <PromptTitle />}
      <GenerationPromptInput
        disableGenerate={isGenerating || !inputValue.trim()}
        generateLabel={t('generation.actions.generate', { defaultValue: 'Generate' })}
        generatingLabel={t('generation.status.generating', { defaultValue: 'Generating' })}
        isCreating={isGenerating}
        isDarkMode={isDarkMode}
        maxRows={customMode ? 8 : 6}
        minRows={3}
        value={inputValue}
        leftActions={
          <Flexbox horizontal align={'center'} gap={4}>
            <GenerationMediaModeSegment mode={'audio'} />
            <ModelSwitchPanel
              ModelItemComponent={AudioModelItem}
              enabledList={enabledAudioModelList as any}
              model={currentModel || CHINNA_AUDIO_MODEL}
              openOnHover={false}
              placement="topLeft"
              provider={currentProvider || CHINNA_AUDIO_PROVIDER}
              onModelChange={async ({ model, provider }) => {
                setModelAndProviderOnSelect(model, provider);
              }}
            >
              <ActionIcon
                icon={getAudioModelIcon(currentModel)}
                size={{
                  blockSize: 36,
                  size: 20,
                }}
              />
            </ModelSwitchPanel>
            <ConfigAction
              title={t('config.title', { defaultValue: 'Accoustica settings' })}
              content={<AudioSettingsContent />}
            />
            <Action
              icon={Music2Icon}
              title={customMode ? 'Advanced lyrics mode' : 'Simple music mode'}
              onClick={() => useAudioStore.getState().setCustomMode(!customMode)}
            />
          </Flexbox>
        }
        placeholder={
          customMode
            ? 'Write or paste lyrics. Use settings for style, title, and instrumental options.'
            : 'Describe your song'
        }
        rightActions={
          <Text fontSize={12} type="secondary">
            {inputValue.length}/{customMode ? MAX_LYRICS : MAX_SIMPLE_PROMPT}
          </Text>
        }
        onGenerate={handleGenerate}
        onValueChange={(value) => {
          const limit = customMode ? MAX_LYRICS : MAX_SIMPLE_PROMPT;
          setInputValue(value.slice(0, limit));
        }}
      />
    </Flexbox>
  );
});

PromptInput.displayName = 'AudioPromptInput';

export default PromptInput;
