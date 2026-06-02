'use client';

import { ActionIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { ArrowLeft, MonitorPlay } from 'lucide-react';

import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';
import { oneLineEllipsis } from '@/styles';

const Title = () => {
  const [closeCodePreview, codePreview] = useChatStore((s) => [
    s.closeCodePreview,
    chatPortalSelectors.currentCodePreview(s),
  ]);

  return (
    <Flexbox horizontal align={'center'} gap={8}>
      <ActionIcon icon={ArrowLeft} size={'small'} onClick={() => closeCodePreview()} />
      <Icon icon={MonitorPlay} size={16} />
      <Text className={cx(oneLineEllipsis)} style={{ fontSize: 16 }} type={'secondary'}>
        {codePreview?.title || codePreview?.fileName || 'Code preview'}
      </Text>
    </Flexbox>
  );
};

export default Title;
