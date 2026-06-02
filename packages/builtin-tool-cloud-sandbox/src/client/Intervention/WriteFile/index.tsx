'use client';

import type { BuiltinInterventionProps } from '@lobechat/types';
import { Flexbox, Highlighter, Text } from '@lobehub/ui';
import { memo } from 'react';

import CodePreview, {
  COMPACT_CODE_PREVIEW_HEIGHT,
  getCodePreviewType,
} from '@/components/CodePreview';

interface WriteLocalFileParams {
  content: string;
  createDirectories?: boolean;
  path: string;
}

const WriteFile = memo<BuiltinInterventionProps<WriteLocalFileParams>>(({ args }) => {
  const { path, content } = args;
  const ext = path.split('.').pop()?.toLowerCase();
  const previewType = getCodePreviewType({ fileName: path, language: ext });
  const preview = content.length > 500 ? content.slice(0, 500) + '\n...(truncated)' : content;

  return (
    <Flexbox gap={8}>
      <Text>Write to file: {path}</Text>
      {previewType && (
        <CodePreview
          content={content}
          fileName={path}
          height={COMPACT_CODE_PREVIEW_HEIGHT}
          language={ext}
        />
      )}
      <Highlighter
        wrap
        language={'text'}
        showLanguage={false}
        style={{ maxHeight: 200, overflow: 'auto', padding: '4px 8px' }}
        variant={'outlined'}
      >
        {preview}
      </Highlighter>
    </Flexbox>
  );
});

export default WriteFile;
