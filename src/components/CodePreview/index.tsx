'use client';

import { ActionIcon, CopyButton, Flexbox, Highlighter, Segmented, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { Maximize2, MonitorPlay } from 'lucide-react';
import { type CSSProperties, memo, useState } from 'react';

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
  previewArea: css`
    overflow: hidden;
    min-height: 0;
  `,
  source: css`
    overflow: auto;
    height: 100%;
  `,
  title: css`
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  toolbar: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgElevated};
  `,
  toolbarButton: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgElevated};
  `,
}));

export type CodePreviewType = 'html' | 'python' | 'react';

export const DEFAULT_CODE_PREVIEW_HEIGHT = 'min(720px, 70vh)';
export const COMPACT_CODE_PREVIEW_HEIGHT = 'min(560px, 58vh)';

type CodePreviewMode = 'preview' | 'source';

const getPreviewTypeLabel = (previewType: CodePreviewType): string => {
  switch (previewType) {
    case 'html': {
      return 'HTML preview';
    }

    case 'python': {
      return 'Python preview';
    }

    case 'react': {
      return 'React preview';
    }
  }
};

const getSourceLanguage = (previewType: CodePreviewType, language: string | undefined): string => {
  if (language) return language;

  switch (previewType) {
    case 'html': {
      return 'html';
    }

    case 'python': {
      return 'python';
    }

    case 'react': {
      return 'tsx';
    }
  }
};

interface GetCodePreviewTypeParams {
  fileName?: string;
  language?: string;
}

export const getCodePreviewType = ({
  fileName,
  language,
}: GetCodePreviewTypeParams): CodePreviewType | undefined => {
  const normalizedLanguage = language?.trim().toLowerCase();
  const normalizedLanguageToken = normalizedLanguage?.split(/[\s,;]+/)[0];
  const normalizedFileName = fileName?.toLowerCase();
  const fileExt = fileName?.split('.').pop()?.toLowerCase();
  const languageExt = normalizedLanguageToken?.split('.').pop();
  const candidates = [normalizedLanguage, normalizedLanguageToken, fileExt, languageExt];

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
    const [mode, setMode] = useState<CodePreviewMode>('preview');
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
        <Flexbox
          horizontal
          align={'center'}
          className={styles.toolbar}
          gap={8}
          paddingBlock={8}
          paddingInline={10}
        >
          <MonitorPlay size={16} />
          <Flexbox flex={1} gap={2} style={{ minWidth: 0 }}>
            <Text className={styles.title} style={{ fontSize: 13 }}>
              {title || fileName || getPreviewTypeLabel(previewType)}
            </Text>
            <Text className={styles.title} style={{ fontSize: 11 }} type={'secondary'}>
              {getPreviewTypeLabel(previewType)}
            </Text>
          </Flexbox>
          <Segmented
            size={'small'}
            value={mode}
            options={[
              { label: 'Preview', value: 'preview' },
              { label: 'Source', value: 'source' },
            ]}
            onChange={(value) => setMode(value as CodePreviewMode)}
          />
          <CopyButton content={content} size={'small'} />
          {showOpenInPortal && (
            <ActionIcon
              aria-label="Open preview in side panel"
              className={styles.toolbarButton}
              icon={Maximize2}
              size={'small'}
              title="Open preview in side panel"
              onClick={(e) => {
                e.stopPropagation();
                openCodePreview({ content, fileName, language, title });
              }}
            />
          )}
        </Flexbox>
        <Flexbox className={styles.previewArea} flex={1}>
          {mode === 'source' ? (
            <Highlighter
              className={styles.source}
              copyable={false}
              language={getSourceLanguage(previewType, language)}
              showLanguage={false}
              variant={'borderless'}
            >
              {content}
            </Highlighter>
          ) : previewType === 'html' ? (
            <HTMLRenderer htmlContent={content} />
          ) : previewType === 'react' ? (
            <ReactRenderer code={content} title={title || fileName} />
          ) : (
            <PythonRenderer code={content} />
          )}
        </Flexbox>
      </Flexbox>
    );
  },
);

CodePreview.displayName = 'CodePreview';

export default CodePreview;
