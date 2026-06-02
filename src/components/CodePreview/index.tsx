'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { Maximize2 } from 'lucide-react';
import { type CSSProperties, memo } from 'react';

import HTMLRenderer from '@/features/Portal/Artifacts/Body/Renderer/HTML';
import dynamic from '@/libs/next/dynamic';
import { useChatStore } from '@/store/chat';

const ReactRenderer = dynamic(() => import('@/features/Portal/Artifacts/Body/Renderer/React'), {
  ssr: false,
});

const PythonRenderer = dynamic(() => import('./PythonRenderer'), {
  ssr: false,
});

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    position: relative;

    overflow: hidden;

    min-height: 360px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
  `,
  openButton: css`
    position: absolute;
    z-index: 5;
    inset-block-start: 8px;
    inset-inline-end: 8px;

    border: 1px solid ${cssVar.colorBorderSecondary};

    opacity: 0.88;
    background: ${cssVar.colorBgElevated};

    &:hover {
      opacity: 1;
    }
  `,
}));

export type CodePreviewType = 'html' | 'python' | 'react';

export const DEFAULT_CODE_PREVIEW_HEIGHT = 'min(720px, 70vh)';
export const COMPACT_CODE_PREVIEW_HEIGHT = 'min(560px, 58vh)';

interface GetCodePreviewTypeParams {
  fileName?: string;
  language?: string;
}

export const getCodePreviewType = ({
  fileName,
  language,
}: GetCodePreviewTypeParams): CodePreviewType | undefined => {
  const normalizedLanguage = language?.toLowerCase();
  const normalizedFileName = fileName?.toLowerCase();
  const ext = fileName?.split('.').pop()?.toLowerCase();
  const candidates = [normalizedLanguage, ext];

  if (candidates.some((type) => type === 'html' || type === 'htm' || type === 'text/html')) {
    return 'html';
  }

  if (
    candidates.some(
      (type) =>
        type === 'py' ||
        type === 'python' ||
        type === 'text/x-python' ||
        type === 'text/python' ||
        type === 'application/x-python-code',
    )
  ) {
    return 'python';
  }

  if (
    normalizedFileName?.endsWith('.app.jsx') ||
    normalizedFileName?.endsWith('.app.tsx') ||
    normalizedFileName === 'app.jsx' ||
    normalizedFileName === 'app.tsx'
  ) {
    return 'react';
  }

  if (
    candidates.some(
      (type) =>
        type === 'jsx' ||
        type === 'tsx' ||
        type === 'react' ||
        type === 'javascriptreact' ||
        type === 'typescriptreact' ||
        type === 'text/jsx' ||
        type === 'text/tsx' ||
        type === 'application/lobe.artifacts.react',
    )
  ) {
    return 'react';
  }
};

export const isPreviewableWebCode = (params: GetCodePreviewTypeParams): boolean => {
  const type = getCodePreviewType(params);
  return type === 'html' || type === 'react';
};

export const isPreviewableCode = (params: GetCodePreviewTypeParams): boolean => {
  return Boolean(getCodePreviewType(params));
};

interface CodePreviewProps extends GetCodePreviewTypeParams {
  className?: string;
  content: string;
  height?: number | string;
  showOpenInPortal?: boolean;
  style?: CSSProperties;
  title?: string;
}

const CodePreview = memo<CodePreviewProps>(
  ({
    className,
    content,
    fileName,
    height = DEFAULT_CODE_PREVIEW_HEIGHT,
    language,
    showOpenInPortal = true,
    style,
    title,
  }) => {
    const previewType = getCodePreviewType({ fileName, language });
    const openCodePreview = useChatStore((s) => s.openCodePreview);

    if (!previewType) return null;

    return (
      <Flexbox
        className={cx(styles.container, className)}
        height={height}
        style={style}
        width={'100%'}
        onClick={(e) => e.stopPropagation()}
      >
        {showOpenInPortal && (
          <ActionIcon
            aria-label="Open preview in side panel"
            className={styles.openButton}
            icon={Maximize2}
            size={'small'}
            title="Open preview in side panel"
            onClick={(e) => {
              e.stopPropagation();
              openCodePreview({ content, fileName, language, title });
            }}
          />
        )}
        {previewType === 'html' ? (
          <HTMLRenderer htmlContent={content} />
        ) : previewType === 'react' ? (
          <ReactRenderer code={content} title={title || fileName} />
        ) : (
          <PythonRenderer code={content} />
        )}
      </Flexbox>
    );
  },
);

CodePreview.displayName = 'CodePreview';

export default CodePreview;
