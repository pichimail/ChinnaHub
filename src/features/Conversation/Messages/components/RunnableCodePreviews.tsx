'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';

import CodePreview, { getCodePreviewType } from '@/components/CodePreview';

const styles = createStaticStyles(({ css }) => ({
  container: css`
    margin-block-start: 12px;
  `,
}));

interface RunnableCodeFence {
  code: string;
  fileName: string;
  language?: string;
}

const codeFenceRegex = /```([^\n`]*)\n([\S\s]*?)```/g;

const inferFileName = (
  language: string | undefined,
  code: string,
  index: number,
): string | undefined => {
  const normalizedLanguage = language?.trim().toLowerCase();

  if (
    normalizedLanguage === 'html' ||
    normalizedLanguage === 'htm' ||
    /^\s*<!doctype html/i.test(code) ||
    /^\s*<html[\s>]/i.test(code)
  ) {
    return `preview-${index + 1}.html`;
  }

  if (
    normalizedLanguage === 'tsx' ||
    normalizedLanguage === 'typescriptreact' ||
    normalizedLanguage === 'text/tsx' ||
    normalizedLanguage === 'react-tsx'
  ) {
    return 'App.tsx';
  }

  if (
    normalizedLanguage === 'jsx' ||
    normalizedLanguage === 'react' ||
    normalizedLanguage === 'javascriptreact' ||
    normalizedLanguage === 'text/jsx' ||
    normalizedLanguage === 'react-jsx'
  ) {
    return 'App.jsx';
  }

  if (
    normalizedLanguage === 'py' ||
    normalizedLanguage === 'python' ||
    normalizedLanguage === 'text/x-python' ||
    normalizedLanguage === 'text/python'
  ) {
    return `preview-${index + 1}.py`;
  }
};

const extractRunnableCodeFences = (content: string): RunnableCodeFence[] => {
  if (!content || content.includes('<lobeArtifact')) return [];

  const previews: RunnableCodeFence[] = [];

  for (const match of content.matchAll(codeFenceRegex)) {
    const language = match[1]?.trim();
    const code = match[2]?.trim();
    if (!code) continue;

    const fileName = inferFileName(language, code, previews.length);
    if (!fileName || !getCodePreviewType({ fileName, language })) continue;

    previews.push({ code, fileName, language });
  }

  return previews;
};

interface RunnableCodePreviewsProps {
  content: string;
}

const RunnableCodePreviews = memo<RunnableCodePreviewsProps>(({ content }) => {
  const previews = useMemo(() => extractRunnableCodeFences(content), [content]);

  if (previews.length === 0) return null;

  return (
    <Flexbox className={styles.container} gap={12}>
      {previews.map((preview, index) => (
        <CodePreview
          content={preview.code}
          fileName={preview.fileName}
          key={`${preview.fileName}-${index}`}
          language={preview.language}
          title={preview.fileName}
        />
      ))}
    </Flexbox>
  );
});

RunnableCodePreviews.displayName = 'RunnableCodePreviews';

export default RunnableCodePreviews;
