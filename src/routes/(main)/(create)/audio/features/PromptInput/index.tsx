'use client';

import { Flexbox } from '@lobehub/ui';
import { Input, Segmented, Switch } from '@lobehub/ui/base-ui';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { loginRequired } from '@/components/Error/loginRequiredNotification';
import { useQueryState } from '@/hooks/useQueryParam';
import {
  ConfigAction,
  GenerationMediaModeSegment,
  GenerationPromptInput,
} from '@/routes/(main)/(create)/features/GenerationInput';
import { useAudioStore } from '@/store/audio';
import { createAudioSelectors } from '@/store/audio/selectors';
import { useAudioGenerationConfigParam } from '@/store/audio/slices/generationConfig/hooks';
import { useGlobalStore } from '@/store/global';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import PromptTitle from './Title';

interface PromptInputProps {
  disableAnimation?: boolean;
  showTitle?: boolean;
}

const PromptInput = memo<PromptInputProps>(({ showTitle = false }) => {
  const { t } = useTranslation('audio');
  const { value, setValue } = useAudioGenerationConfigParam('prompt');
  const { value: customMode, setValue: setCustomMode } =
    useAudioGenerationConfigParam('customMode');
  const { value: instrumental, setValue: setInstrumental } =
    useAudioGenerationConfigParam('instrumental');
  const { value: style, setValue: setStyle } = useAudioGenerationConfigParam('style');
  const { value: title, setValue: setTitle } = useAudioGenerationConfigParam('title');
  const { value: negativeTags, setValue: setNegativeTags } =
    useAudioGenerationConfigParam('negativeTags');
  const isCreating = useAudioStore(createAudioSelectors.isCreating);
  const createAudio = useAudioStore((s) => s.createAudio);
  const updateSystemStatus = useGlobalStore((s) => s.updateSystemStatus);
  const isLogin = useUserStore(authSelectors.isLogin);

  const [promptParam, setPromptParam] = useQueryState('prompt');
  const hasProcessedPrompt = useRef(false);

  useEffect(() => {
    updateSystemStatus({ lastSelectedGenerationMode: 'audio' });
  }, [updateSystemStatus]);

  useEffect(() => {
    if (promptParam && !hasProcessedPrompt.current && isLogin) {
      const decodedPrompt = decodeURIComponent(promptParam);
      setValue(decodedPrompt as any);
      hasProcessedPrompt.current = true;
      setPromptParam(null);

      const tId = setTimeout(async () => {
        await createAudio();
      }, 100);

      return () => clearTimeout(tId);
    }
  }, [promptParam, isLogin, setValue, setPromptParam, createAudio]);

  const onGenerate = async () => {
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }
    await createAudio();
  };

  return (
    <GenerationPromptInput
      centerActions={<GenerationMediaModeSegment mode={'audio'} />}
      generateLabel={t('generation.actions.generate')}
      generatingLabel={t('generation.status.generating')}
      header={showTitle ? <PromptTitle /> : undefined}
      isCreating={isCreating}
      placeholder={t('config.prompt.placeholder')}
      value={value as string}
      rightActions={
        <Flexbox horizontal align={'center'} gap={8}>
          <ConfigAction
            title={t('config.header.title')}
            content={
              <Flexbox gap={10}>
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <span>{t('config.customMode.label')}</span>
                  <Switch checked={!!customMode} onChange={(v) => setCustomMode(v)} />
                </Flexbox>
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <span>{t('config.instrumental.label')}</span>
                  <Switch checked={!!instrumental} onChange={(v) => setInstrumental(v)} />
                </Flexbox>
                <Segmented
                  value={!!customMode}
                  options={[
                    { label: t('config.mode.simple'), value: false },
                    { label: t('config.mode.advanced'), value: true },
                  ]}
                  onChange={(v) => setCustomMode(v as boolean)}
                />
                {!!customMode && (
                  <>
                    <Input
                      maxLength={80}
                      placeholder={t('config.title.placeholder')}
                      value={(title as string) || ''}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                    <Input.TextArea
                      maxLength={1000}
                      placeholder={t('config.style.placeholder')}
                      rows={2}
                      value={(style as string) || ''}
                      onChange={(e) => setStyle(e.target.value)}
                    />
                    <Input
                      maxLength={300}
                      placeholder={t('config.negativeTags.placeholder')}
                      value={(negativeTags as string) || ''}
                      onChange={(e) => setNegativeTags(e.target.value)}
                    />
                  </>
                )}
              </Flexbox>
            }
          />
        </Flexbox>
      }
      onGenerate={onGenerate}
      onValueChange={(v) => setValue(v as any)}
    />
  );
});

PromptInput.displayName = 'AudioPromptInput';

export default PromptInput;
