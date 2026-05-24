'use client';

import { Flexbox, Segmented, Text } from '@lobehub/ui';
import { Input, Select, Switch } from 'antd';
import { Music2 } from 'lucide-react';
import { memo, useEffect } from 'react';
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
import { authSelectors } from '@/store/user/slices/auth/selectors';

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
  const {
    createAudio,
    initializeAudioConfig,
    setAudioPrompt,
    setAudioProviderMode,
    setAudioStyle,
    setAudioTitle,
    setMakeInstrumental,
  } = useAudioStore();

  useEffect(() => {
    if (!isInit) initializeAudioConfig();
  }, [initializeAudioConfig, isInit]);

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
              title={'Accoustica settings'}
              trigger={'click'}
              popover={{
                content: (
                  <Flexbox gap={12} style={{ minWidth: 280 }}>
                    <Flexbox gap={6}>
                      <Text fontSize={12}>Model</Text>
                      <Segmented
                        block
                        value={parameters.providerMode || 'classic'}
                        variant="filled"
                        options={[
                          { label: 'Accoustica Classic', value: 'classic' },
                          { label: 'Accoustica Lyria', value: 'lyria' },
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
                title: 'Accoustica',
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
