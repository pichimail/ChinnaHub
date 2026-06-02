'use client';

import { Center, Flexbox, Highlighter, Segmented } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Code2, Eye } from 'lucide-react';
import { memo, useState } from 'react';

import CodePreview from '@/components/CodePreview';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';

import { useTextFileLoader } from '../../hooks/useTextFileLoader';
import { getLanguage } from '../Code';

const styles = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    min-height: 0;
  `,
  code: css`
    overflow: auto;
    min-height: 0;
    padding-inline: 24px 4px;
  `,
  page: css`
    width: 100%;
    height: 100%;
    background: ${cssVar.colorBgLayout};
  `,
  toolbar: css`
    padding-block: 8px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
}));

interface PreviewableCodeViewerProps {
  fileId: string;
  fileName?: string;
  url: string | null;
}

const PreviewableCodeViewer = memo<PreviewableCodeViewerProps>(({ url, fileName }) => {
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const { fileData, loading } = useTextFileLoader(url);
  const language = getLanguage(fileName);

  if (loading || !fileData) {
    return (
      <Center height={'100%'}>
        <NeuralNetworkLoading size={36} />
      </Center>
    );
  }

  return (
    <Flexbox className={styles.page}>
      <Flexbox horizontal align={'center'} className={styles.toolbar} justify={'flex-end'}>
        <Segmented
          value={mode}
          options={[
            {
              label: (
                <Flexbox horizontal align={'center'} gap={6}>
                  <Eye size={16} />
                  Preview
                </Flexbox>
              ),
              value: 'preview',
            },
            {
              label: (
                <Flexbox horizontal align={'center'} gap={6}>
                  <Code2 size={16} />
                  Code
                </Flexbox>
              ),
              value: 'code',
            },
          ]}
          onChange={(value) => setMode(value as 'preview' | 'code')}
        />
      </Flexbox>
      <Flexbox className={styles.body} flex={1}>
        {mode === 'preview' ? (
          <CodePreview content={fileData} fileName={fileName} height={'100%'} title={fileName} />
        ) : (
          <Flexbox className={styles.code} height={'100%'}>
            <Highlighter language={language} showLanguage={false} variant={'borderless'}>
              {fileData}
            </Highlighter>
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  );
});

PreviewableCodeViewer.displayName = 'PreviewableCodeViewer';

export default PreviewableCodeViewer;
