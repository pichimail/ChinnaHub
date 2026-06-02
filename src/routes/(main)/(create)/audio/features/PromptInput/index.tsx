'use client';

import { Flexbox, Segmented, Text } from '@lobehub/ui';
import { Collapse, Input, Select, Switch } from 'antd';
import { Music2 } from 'lucide-react';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { loginRequired } from '@/components/Error/loginRequiredNotification';
import Action from '@/features/ChatInput/ActionBar/components/Action';
import { useIsDark } from '@/hooks/useIsDark';
import {
  GenerationMediaModeSegment,
  GenerationPromptInput,
} from '@/routes/(main)/(create)/features/GenerationInput';
import { audioGenerationConfigSelectors, createAudioSelectors, useAudioStore } from '@/store/audio';
import { useUserStore } from '@/store/user';
import { authSelectors, userProfileSelectors } from '@/store/user/slices/auth/selectors';

import PromptTitle from './Title';

interface PromptInputProps {
  disableAnimation?: boolean;
  showTitle?: boolean;
}

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

const PromptInput = memo<PromptInputProps>(({ showTitle = false }) => {
  const isDarkMode = useIsDark();
  const { t } = useTranslation('audio');
  const parameters = useAudioStore(audioGenerationConfigSelectors.parameters);
  const isInit = useAudioStore(audioGenerationConfigSelectors.isInit);
  const isCreating = useAudioStore(createAudioSelectors.isCreating);
  const isLogin = useUserStore(authSelectors.isLogin);
  const username = useUserStore(userProfileSelectors.username);
  const hasSetDefaultArtist = useRef(false);
  const {
    createAudio,
    initializeAudioConfig,
    setAudioArtist,
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

  const handleGenerate = async () => {
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }

    await createAudio();
  };

  return (
    <Flexbox gap={32} width={'100%'}>
      {showTitle && <PromptTitle />}
      <GenerationPromptInput
        disableGenerate={!isInit}
        generateLabel={t('generation.generate')}
        generatingLabel={t('generation.generating', { defaultValue: 'Generating audio...' })}
        isCreating={isCreating}
        isDarkMode={isDarkMode}
        placeholder={t('generation.promptPlaceholder')}
        value={parameters.prompt || ''}
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
                          key: 'advanced',
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
                        onChange={(value) => setAudioStyle(value)}
                      />
                    </Flexbox>
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
        onGenerate={handleGenerate}
        onValueChange={setAudioPrompt}
      />
    </Flexbox>
  );
});

PromptInput.displayName = 'AudioPromptInput';

export { PromptInput };
export default PromptInput;
