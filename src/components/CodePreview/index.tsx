'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { type CSSProperties, memo } from 'react';

import HTMLRenderer from '@/features/Portal/Artifacts/Body/Renderer/HTML';
import dynamic from '@/libs/next/dynamic';

const ReactRenderer = dynamic(() => import('@/features/Portal/Artifacts/Body/Renderer/React'), {
  ssr: false,
});

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;
    background: ${cssVar.colorBgContainer};
  `,
}));

type CodePreviewType = 'html' | 'react';

interface GetCodePreviewTypeParams {
  fileName?: string;
  language?: string;
}

export const getCodePreviewType = ({
  fileName,
  language,
}: GetCodePreviewTypeParams): CodePreviewType | undefined => {
  const normalizedLanguage = language?.toLowerCase();
  const ext = fileName?.split('.').pop()?.toLowerCase();
  const candidates = [normalizedLanguage, ext];

  if (candidates.some((type) => type === 'html' || type === 'htm')) return 'html';
  if (
    candidates.some(
      (type) =>
        type === 'jsx' ||
        type === 'tsx' ||
        type === 'react' ||
        type === 'javascriptreact' ||
        type === 'typescriptreact',
    )
  ) {
    return 'react';
  }
};

interface CodePreviewProps extends GetCodePreviewTypeParams {
  className?: string;
  content: string;
  height?: number | string;
  style?: CSSProperties;
  title?: string;
}

const CodePreview = memo<CodePreviewProps>(
  ({ className, content, fileName, height = 320, language, style, title }) => {
    const previewType = getCodePreviewType({ fileName, language });

    if (!previewType) return null;

    return (
      <Flexbox
        className={cx(styles.container, className)}
        height={height}
        style={style}
        width={'100%'}
        onClick={(e) => e.stopPropagation()}
      >
        {previewType === 'html' ? (
          <HTMLRenderer htmlContent={content} />
        ) : (
          <ReactRenderer code={content} title={title || fileName} />
        )}
      </Flexbox>
    );
  },
);

CodePreview.displayName = 'CodePreview';

export default CodePreview;
