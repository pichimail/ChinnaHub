'use client';

import { Block, Center, Flexbox, Skeleton } from '@lobehub/ui';
import { memo } from 'react';

import PromptInput from '@/routes/(main)/(create)/audio/features/PromptInput';

interface SkeletonListProps {
  embedInput?: boolean;
}

const SkeletonList = memo<SkeletonListProps>(({ embedInput = true }) => {
  return (
    <Flexbox style={{ minHeight: 'calc(100vh - 44px)' }}>
      <Block variant={'borderless'}>
        <Flexbox gap={12}>
          <Skeleton.Button active style={{ height: 20, width: '95%' }} />
          <Skeleton.Button active style={{ height: 44, width: '100%' }} />
          <Skeleton.Button active style={{ height: 14, width: 140 }} />
        </Flexbox>
      </Block>
      <div style={{ flex: 1 }} />
      {embedInput && (
        <Center style={{ bottom: 24, position: 'sticky', width: '100%' }}>
          <PromptInput disableAnimation={true} showTitle={false} />
        </Center>
      )}
    </Flexbox>
  );
});

SkeletonList.displayName = 'AudioSkeletonList';

export default SkeletonList;
