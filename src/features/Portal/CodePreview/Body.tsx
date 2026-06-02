'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import CodePreview from '@/components/CodePreview';
import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';

const Body = memo(() => {
  const codePreview = useChatStore(chatPortalSelectors.currentCodePreview);

  if (!codePreview) return null;

  return (
    <Flexbox flex={1} padding={12} style={{ minHeight: 0, overflow: 'hidden' }}>
      <CodePreview
        content={codePreview.content}
        fileName={codePreview.fileName}
        height={'100%'}
        language={codePreview.language}
        showOpenInPortal={false}
        title={codePreview.title || codePreview.fileName}
      />
    </Flexbox>
  );
});

Body.displayName = 'PortalCodePreviewBody';

export default Body;
