'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useEffect, useMemo } from 'react';

import CodePreview, { getCodePreviewType } from '@/components/CodePreview';
import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';

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
const fileNameRegex =
  /(?:^|\s)(?:file(?:name)?|path|name)=["']?([^\s"']+\.(?:html?|jsx|tsx|py))["']?/i;
const bareFileNameRegex = /(?:^|\s)([^\s"']+\.(?:html?|jsx|tsx|py))(?:\s|$)/i;

const parseCodeFenceInfo = (info: string | undefined) => {
  const normalizedInfo = info?.trim();
  const language = normalizedInfo?.split(/\s+/)[0];
  const fileName =
    normalizedInfo?.match(fileNameRegex)?.[1] || normalizedInfo?.match(bareFileNameRegex)?.[1];

  return { fileName, language };
};

const inferFileName = (
  info: string | undefined,
  code: string,
  index: number,
): string | undefined => {
  const { fileName, language } = parseCodeFenceInfo(info);
  if (fileName) return fileName;

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
    const info = match[1]?.trim();
    const { language } = parseCodeFenceInfo(info);
    const code = match[2]?.trim();
    if (!code) continue;

    const fileName = inferFileName(info, code, previews.length);
    if (!fileName || !getCodePreviewType({ fileName, language })) continue;

    previews.push({ code, fileName, language });
  }

  return previews;
};

interface RunnableCodePreviewsProps {
  autoOpen?: boolean;
  content: string;
}

const RunnableCodePreviews = memo<RunnableCodePreviewsProps>(({ autoOpen, content }) => {
  const previews = useMemo(() => extractRunnableCodeFences(content), [content]);
  const [currentCodePreview, openCodePreview] = useChatStore((s) => [
    chatPortalSelectors.currentCodePreview(s),
    s.openCodePreview,
  ]);
  const primaryPreview = previews.at(-1);
  const currentPreviewSignature = currentCodePreview
    ? `${currentCodePreview.fileName || ''}:${currentCodePreview.language || ''}:${
        currentCodePreview.content
      }`
    : '';
  const primaryPreviewSignature = primaryPreview
    ? `${primaryPreview.fileName}:${primaryPreview.language || ''}:${primaryPreview.code}`
    : '';

  useEffect(() => {
    if (!autoOpen || !primaryPreview || currentPreviewSignature === primaryPreviewSignature) return;

    openCodePreview({
      content: primaryPreview.code,
      fileName: primaryPreview.fileName,
      language: primaryPreview.language,
      title: primaryPreview.fileName,
    });
  }, [autoOpen, currentPreviewSignature, openCodePreview, primaryPreview, primaryPreviewSignature]);

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
