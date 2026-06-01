import type { WriteLocalFileParams } from '@lobechat/electron-client-ipc';
import type { BuiltinInterventionProps } from '@lobechat/types';
import { Flexbox, Highlighter, Icon, Text } from '@lobehub/ui';
import { ChevronRight } from 'lucide-react';
import path from 'path-browserify-esm';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import CodePreview, { getCodePreviewType } from '@/components/CodePreview';
import { LocalFile, LocalFolder } from '@/features/LocalFile';

import OutOfScopeWarning from '../OutOfScopeWarning';

const WriteFile = memo<BuiltinInterventionProps<WriteLocalFileParams>>(({ args }) => {
  const { t } = useTranslation('tool');
  const { base, dir, ext } = path.parse(args.path || '');

  // Detect language from file extension
  const language = useMemo(() => {
    const extMap: Record<string, string> = {
      css: 'css',
      html: 'html',
      js: 'javascript',
      json: 'json',
      jsx: 'jsx',
      md: 'markdown',
      py: 'python',
      sh: 'bash',
      ts: 'typescript',
      tsx: 'tsx',
      txt: 'text',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
    };
    return extMap[ext.replace('.', '')] || 'text';
  }, [ext]);

  const contentLength = args.content?.length || 0;
  const previewType = getCodePreviewType({ fileName: base, language: ext.replace('.', '') });

  return (
    <Flexbox gap={12}>
      <OutOfScopeWarning paths={[args.path]} />
      <Flexbox horizontal>
        <LocalFolder path={dir} />
        <Icon icon={ChevronRight} />
        <LocalFile name={base} path={args.path} />
      </Flexbox>

      <Flexbox gap={4}>
        <Flexbox horizontal justify={'space-between'}>
          <Text type="secondary">{t('localFiles.writeFile.preview')}</Text>
          <Text style={{ fontSize: 12 }} type={'secondary'}>
            {contentLength.toLocaleString()} {t('localFiles.writeFile.characters')}
          </Text>
        </Flexbox>

        {args.content && (
          <Flexbox gap={8}>
            {previewType && (
              <CodePreview
                content={args.content}
                fileName={base}
                height={320}
                language={ext.replace('.', '')}
              />
            )}
            <Highlighter
              language={language}
              showLanguage={false}
              style={{ maxHeight: 400, overflow: 'auto', padding: '8px' }}
              variant={'outlined'}
            >
              {args.content}
            </Highlighter>
          </Flexbox>
        )}
      </Flexbox>
    </Flexbox>
  );
});

WriteFile.displayName = 'WriteFileIntervention';

export default WriteFile;
