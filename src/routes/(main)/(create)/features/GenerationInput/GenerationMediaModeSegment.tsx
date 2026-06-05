'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Select, type SelectProps } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { ImageIcon, Music2Icon, Video } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export type GenerationMediaMode = 'audio' | 'image' | 'video';

export interface GenerationMediaModeSegmentProps {
  /** `hero`: large inline headline select. `toolbar`: compact control in the input bar. */
  layout?: 'hero' | 'toolbar';
  mode: GenerationMediaMode;
}

const styles = createStaticStyles(({ css }) => ({
  lite: css`
    height: 36px;
    min-width: 0;
  `,
  heroSelect: css`
    width: auto;
    min-width: 0;
    font-size: inherit;
    line-height: 1.2;
  `,
  heroText: css`
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
  `,
}));

const getModeIcon = (mode: GenerationMediaMode) => {
  if (mode === 'video') return Video;
  if (mode === 'audio') return Music2Icon;
  return ImageIcon;
};

const GenerationMediaModeSegment = memo<GenerationMediaModeSegmentProps>(
  ({ mode, layout = 'toolbar' }) => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();
    const isHero = layout === 'hero';

    const labelMap = useMemo(
      () => ({
        audio: t('tab.audio', { defaultValue: 'Accoustica' }),
        image: t('tab.image'),
        video: t('tab.video'),
      }),
      [t],
    );

    const options = useMemo<SelectProps['options']>(
      () =>
        (['image', 'video', 'audio'] as GenerationMediaMode[]).map((value) => {
          const ModeIcon = getModeIcon(value);

          return {
            label: (
              <Flexbox horizontal align="center" gap={8}>
                {!isHero && <Icon icon={ModeIcon} />}
                <span className={isHero ? styles.heroText : undefined}>{labelMap[value]}</span>
              </Flexbox>
            ),
            value,
          };
        }),
      [isHero, labelMap],
    );

    const labelRender: SelectProps['labelRender'] = useCallback(
      (props: any) => {
        const value = String((props as { value?: string }).value ?? 'image') as GenerationMediaMode;
        const ModeIcon = getModeIcon(value);
        const text = labelMap[value] ?? labelMap.image;

        if (isHero) {
          return (
            <span
              style={{
                fontSize: 'inherit',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </span>
          );
        }

        return (
          <Flexbox horizontal align="center" gap={6} style={{ maxWidth: 132 }}>
            <Icon icon={ModeIcon} size={16} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {text}
            </span>
          </Flexbox>
        );
      },
      [isHero, labelMap],
    );

    const handleChange = useCallback(
      (value: string) => {
        if (value === mode) return;
        navigate(value === 'video' ? '/video' : value === 'audio' ? '/audio' : '/image');
      },
      [mode, navigate],
    );

    return (
      <Select
        className={isHero ? styles.heroSelect : styles.lite}
        labelRender={labelRender}
        options={options}
        popupMatchSelectWidth={false}
        size={isHero ? 'large' : 'middle'}
        style={isHero ? undefined : { width: 'auto' }}
        value={mode}
        variant={isHero ? 'borderless' : 'filled'}
        onChange={handleChange}
      />
    );
  },
);

GenerationMediaModeSegment.displayName = 'GenerationMediaModeSegment';

export default GenerationMediaModeSegment;
