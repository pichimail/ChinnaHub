import { ArtifactType } from '@lobechat/types';
import { ActionIcon, Flexbox, Icon, Segmented, Text } from '@lobehub/ui';
import { Button, ConfigProvider, Dropdown, message } from 'antd';
import { cx } from 'antd-style';
import { ArrowLeft, CodeIcon, DownloadIcon, EyeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';
import { ArtifactDisplayMode } from '@/store/chat/slices/portal/initialState';
import { oneLineEllipsis } from '@/styles';

import { copyArtifactSetupCommand, downloadArtifact } from './exportArtifact';

const Title = () => {
  const { t } = useTranslation('portal');

  const [
    displayMode,
    artifactType,
    artifactTitle,
    artifactContent,
    isArtifactTagClosed,
    closeArtifact,
  ] = useChatStore((s) => {
    const messageId = chatPortalSelectors.artifactMessageId(s) || '';
    const identifier = chatPortalSelectors.artifactIdentifier(s);

    return [
      s.portalArtifactDisplayMode,
      chatPortalSelectors.artifactType(s),
      chatPortalSelectors.artifactTitle(s),
      chatPortalSelectors.artifactCode(messageId, identifier)(s),
      chatPortalSelectors.isArtifactTagClosed(messageId, identifier)(s),
      s.closeArtifact,
    ];
  });

  // show switch only when artifact is closed and the type is not code
  const showSwitch = isArtifactTagClosed && artifactType !== ArtifactType.Code;

  return (
    <Flexbox horizontal align={'center'} flex={1} gap={12} justify={'space-between'} width={'100%'}>
      <Flexbox horizontal align={'center'} gap={4}>
        <ActionIcon icon={ArrowLeft} size={'small'} onClick={() => closeArtifact()} />
        <Text className={cx(oneLineEllipsis)} type={'secondary'}>
          {artifactTitle}
        </Text>
      </Flexbox>
      <ConfigProvider
        theme={{
          token: {
            borderRadiusSM: 16,
            borderRadiusXS: 16,
            fontSize: 12,
          },
        }}
      >
        {showSwitch && (
          <Flexbox horizontal align={'center'} gap={8}>
            <Segmented
              size={'small'}
              value={displayMode}
              options={[
                {
                  icon: <Icon icon={EyeIcon} />,
                  label: t('artifacts.display.preview'),
                  value: ArtifactDisplayMode.Preview,
                },
                {
                  icon: <Icon icon={CodeIcon} />,
                  label: t('artifacts.display.code'),
                  value: ArtifactDisplayMode.Code,
                },
              ]}
              onChange={(value) => {
                useChatStore.setState({ portalArtifactDisplayMode: value as ArtifactDisplayMode });
              }}
            />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'html', label: t('artifacts.download.html') },
                  { key: 'tsx', label: t('artifacts.download.tsx') },
                  { key: 'jsx', label: t('artifacts.download.jsx') },
                  { key: 'nextjs', label: t('artifacts.download.nextjs') },
                  { type: 'divider' },
                  { key: 'setup', label: t('artifacts.download.setup') },
                ],
                onClick: async ({ key }) => {
                  if (!artifactContent) return;

                  if (key === 'setup') {
                    await copyArtifactSetupCommand(artifactTitle);
                    message.success(t('artifacts.download.setupCopied'));
                    return;
                  }

                  downloadArtifact(
                    artifactContent,
                    artifactTitle,
                    key as 'html' | 'jsx' | 'nextjs' | 'tsx',
                  );
                },
              }}
            >
              <Button icon={<DownloadIcon size={14} />} size={'small'}>
                {t('artifacts.download.title')}
              </Button>
            </Dropdown>
          </Flexbox>
        )}
      </ConfigProvider>
    </Flexbox>
  );
};

export default Title;
