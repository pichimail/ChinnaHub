'use client';

import { BRANDING_PROVIDER } from '@lobechat/business-const';
import { CREDITS_PER_DOLLAR } from '@lobechat/const/currency';
import { ModelIcon } from '@lobehub/icons';
import { Flexbox, Icon, Popover, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { Music2Icon, VideoIcon } from 'lucide-react';
import type { AiModelForSelect } from 'model-bank';
import numeral from 'numeral';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import NewModelBadge from '@/components/ModelSelect/NewModelBadge';
import { useIsDark } from '@/hooks/useIsDark';
import { useServerConfigStore } from '@/store/serverConfig';
import { serverConfigSelectors } from '@/store/serverConfig/selectors';

const POPOVER_MAX_WIDTH = 320;

const styles = createStaticStyles(({ css, cssVar }) => ({
  descriptionText: css`
    color: ${cssVar.colorTextSecondary};
  `,
  descriptionText_dark: css`
    color: ${cssVar.colorText};
  `,
  popover: css`
    .ant-popover-inner {
      background: ${cssVar.colorBgElevated};
    }
  `,
  popover_dark: css`
    .ant-popover-inner {
      background: ${cssVar.colorBgSpotlight};
    }
  `,
  priceText: css`
    font-weight: 500;
    color: ${cssVar.colorTextTertiary};
    word-break: keep-all;
    white-space: nowrap;
  `,
  priceText_dark: css`
    font-weight: 500;
    color: ${cssVar.colorTextLightSolid};
  `,
}));

export interface GenerationModelItemProps extends AiModelForSelect {
  priceKind?: 'audio' | 'image' | 'video';
  providerId?: string;
  showBadge?: boolean;
  showPopover?: boolean;
  showPrice?: boolean;
}

const getSafeModelIcon = (id: string, priceKind: GenerationModelItemProps['priceKind']) => {
  if (id === 'chinnaaudio' || id === 'accoustica' || priceKind === 'audio') {
    return <Icon icon={Music2Icon} size={20} />;
  }

  if (id === 'chinnavideo') {
    return <Icon icon={VideoIcon} size={20} />;
  }

  return <ModelIcon model={id || 'gpt-4o'} size={20} />;
};

const GenerationModelItem = memo<GenerationModelItemProps>(
  ({
    approximatePricePerImage,
    approximatePricePerVideo,
    description,
    pricePerImage,
    pricePerVideo,
    providerId,
    showPopover = true,
    showBadge = true,
    showPrice = false,
    priceKind = 'image',
    ...model
  }) => {
    const isDarkMode = useIsDark();
    const { t } = useTranslation('components');
    const enableBusinessFeatures = useServerConfigStore(
      serverConfigSelectors.enableBusinessFeatures,
    );

    const priceLabel = useMemo(() => {
      if (!showPrice) return undefined;

      const isVideo = priceKind === 'video';
      const exactUsd = isVideo ? pricePerVideo : pricePerImage;
      const approxUsd = isVideo ? approximatePricePerVideo : approximatePricePerImage;

      if (priceKind === 'audio') return undefined;

      if (enableBusinessFeatures && providerId === BRANDING_PROVIDER) {
        if (typeof exactUsd === 'number') {
          const credits = exactUsd * CREDITS_PER_DOLLAR;
          return t(
            isVideo
              ? 'GenerationModelItem.creditsPerVideoExact'
              : 'GenerationModelItem.creditsPerImageExact',
            { amount: numeral(credits).format('0,0') },
          );
        }
        if (typeof approxUsd === 'number') {
          const credits = approxUsd * CREDITS_PER_DOLLAR;
          return t(
            isVideo
              ? 'GenerationModelItem.creditsPerVideoApproximate'
              : 'GenerationModelItem.creditsPerImageApproximate',
            { amount: numeral(credits).format('0,0') },
          );
        }
      } else {
        if (typeof exactUsd === 'number') {
          return `${numeral(exactUsd).format('$0,0.00[000]')} / ${isVideo ? 'video' : 'image'}`;
        }
        if (typeof approxUsd === 'number') {
          return `~ ${numeral(approxUsd).format('$0,0.00[000]')} / ${isVideo ? 'video' : 'image'}`;
        }
      }
      return undefined;
    }, [
      showPrice,
      approximatePricePerImage,
      approximatePricePerVideo,
      enableBusinessFeatures,
      pricePerImage,
      pricePerVideo,
      priceKind,
      providerId,
      t,
    ]);

    const popoverContent = useMemo(() => {
      if (!description && !priceLabel) return null;

      return (
        <Flexbox gap={8} style={{ maxWidth: POPOVER_MAX_WIDTH }}>
          {description && (
            <Text className={cx(styles.descriptionText, isDarkMode && styles.descriptionText_dark)}>
              {description}
            </Text>
          )}
          {priceLabel && (
            <Text className={cx(styles.priceText, isDarkMode && styles.priceText_dark)}>
              {priceLabel}
            </Text>
          )}
        </Flexbox>
      );
    }, [description, priceLabel, isDarkMode]);

    const id = model.id || '';
    const displayName = model.displayName || id;

    const content = (
      <Flexbox horizontal align={'center'} gap={8} style={{ overflow: 'hidden' }}>
        {getSafeModelIcon(id, priceKind)}
        <Text ellipsis title={displayName}>
          {displayName}
        </Text>
        {showBadge && <NewModelBadge releasedAt={model.releasedAt} />}
      </Flexbox>
    );

    if (!showPopover || !popoverContent) return content;

    return (
      <Popover
        classNames={{ root: cx(styles.popover, isDarkMode && styles.popover_dark) }}
        content={popoverContent}
        placement="rightTop"
      >
        {content}
      </Popover>
    );
  },
);

GenerationModelItem.displayName = 'GenerationModelItem';

export default GenerationModelItem;
