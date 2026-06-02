'use client';

import { type CodeInterpreterResponse } from '@lobechat/types';
import { Button, Center, Flexbox, Highlighter, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { Play, RotateCw } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { pythonService } from '@/services/python';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    min-height: 0;
    background: ${cssVar.colorBgLayout};
  `,
  error: css`
    border-color: ${cssVar.colorErrorBorder};
    background: ${cssVar.colorErrorBg};
  `,
  fileImage: css`
    max-width: 100%;
    max-height: 360px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    object-fit: contain;
    background: ${cssVar.colorBgContainer};
  `,
  output: css`
    overflow: auto;

    min-height: 160px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorBgContainer};
  `,
  toolbar: css`
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
}));

const isImageFile = (fileName: string) => /\.(?:gif|jpe?g|png|webp)$/i.test(fileName);

interface PythonRendererProps {
  code: string;
}

const PythonRenderer = memo<PythonRendererProps>(({ code }) => {
  const [error, setError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CodeInterpreterResponse>();

  const runCode = useCallback(async () => {
    setIsRunning(true);
    setError(undefined);

    try {
      const response = await pythonService.runPython(code, [], []);
      if (!response) {
        setError('Python preview is available only in a browser runtime with Web Worker support.');
        return;
      }

      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  }, [code]);

  useEffect(() => {
    void runCode();
  }, [runCode]);

  useEffect(() => {
    return () => {
      for (const file of result?.files || []) {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      }
    };
  }, [result?.files]);

  const output = useMemo(() => {
    if (error) return error;

    const lines = result?.output?.map((item) => item.data) || [];
    if (result?.result) lines.push(result.result);

    return lines.join('\n').trim();
  }, [error, result]);

  const hasOutput = !!output;
  const generatedFiles = result?.files || [];

  return (
    <Flexbox className={styles.container} height={'100%'} width={'100%'}>
      <Flexbox horizontal align={'center'} className={styles.toolbar} gap={8} padding={8}>
        <Button
          disabled={isRunning}
          icon={isRunning ? RotateCw : Play}
          size={'small'}
          onClick={runCode}
        >
          {isRunning ? 'Running' : 'Run'}
        </Button>
        <Text style={{ fontSize: 12 }} type={'secondary'}>
          Python browser preview
        </Text>
      </Flexbox>

      <Flexbox flex={1} gap={12} padding={12} style={{ minHeight: 0, overflow: 'auto' }}>
        {isRunning && !result && !error ? (
          <Center flex={1}>
            <Text type={'secondary'}>Starting Python runtime...</Text>
          </Center>
        ) : hasOutput ? (
          <Highlighter
            className={cx(styles.output, error && styles.error)}
            language={'text'}
            style={{ minHeight: 160 }}
          >
            {output}
          </Highlighter>
        ) : (
          <Center className={styles.output}>
            <Text type={'secondary'}>No output</Text>
          </Center>
        )}

        {generatedFiles.length > 0 && (
          <Flexbox gap={12}>
            {generatedFiles.map((file) => {
              if (!file.previewUrl) return null;

              return isImageFile(file.filename) ? (
                <img
                  alt={file.filename}
                  className={styles.fileImage}
                  key={file.filename}
                  src={file.previewUrl}
                />
              ) : (
                <a href={file.previewUrl} key={file.filename} rel="noreferrer" target="_blank">
                  {file.filename}
                </a>
              );
            })}
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  );
});

PythonRenderer.displayName = 'PythonRenderer';

export default PythonRenderer;
