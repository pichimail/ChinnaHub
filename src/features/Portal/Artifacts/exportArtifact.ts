import { strToU8, zipSync } from 'fflate';

const sanitizeName = (name?: string) => {
  const cleaned = (name || 'generated-preview')
    .trim()
    .replaceAll(/[^\w.-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .toLowerCase();

  return cleaned || 'generated-preview';
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const htmlToReactComponent = (content: string, title: string, typescript: boolean) => {
  const propsType = typescript ? '\ntype GeneratedArtifactProps = { className?: string };\n' : '';
  const props = typescript ? ': GeneratedArtifactProps' : '';

  return `import React from 'react';
${propsType}
const html = ${JSON.stringify(content)};

export default function GeneratedArtifact({ className }${props}) {
  return (
    <iframe
      className={className}
      srcDoc={html}
      style={{ width: '100%', height: '100vh', border: 0 }}
      title=${JSON.stringify(title || 'Generated artifact')}
    />
  );
}
`;
};

const nextPage = (content: string, title: string) => `const html = ${JSON.stringify(content)};

export default function Page() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <iframe
        srcDoc={html}
        style={{ width: '100%', height: '100vh', border: 0 }}
        title=${JSON.stringify(title || 'Generated artifact')}
      />
    </main>
  );
}
`;

export const buildArtifactReadme = (name: string) => `# ${name}

This package was exported from Chinna AI.

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000 in your browser.
`;

export const copyArtifactSetupCommand = async (title?: string) => {
  const name = sanitizeName(title);
  const command = `unzip ${name}-nextjs.zip -d ${name} && cd ${name} && code . && npm install && npm run dev`;
  await navigator.clipboard.writeText(command);
};

export const downloadArtifact = (
  content: string,
  title: string | undefined,
  format: 'html' | 'jsx' | 'nextjs' | 'tsx',
) => {
  const name = sanitizeName(title);

  if (format === 'html') {
    downloadBlob(new Blob([content], { type: 'text/html;charset=utf-8' }), `${name}.html`);
    return;
  }

  if (format === 'tsx' || format === 'jsx') {
    const source = htmlToReactComponent(content, title || name, format === 'tsx');
    downloadBlob(new Blob([source], { type: 'text/plain;charset=utf-8' }), `${name}.${format}`);
    return;
  }

  const files = {
    'README.md': strToU8(buildArtifactReadme(name)),
    'app/layout.tsx': strToU8(`import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: ${JSON.stringify(title || name)},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
`),
    'app/page.tsx': strToU8(nextPage(content, title || name)),
    'next-env.d.ts': strToU8(`/// <reference types="next" />
/// <reference types="next/image-types/global" />
`),
    'package.json': strToU8(
      JSON.stringify(
        {
          private: true,
          scripts: {
            build: 'next build',
            dev: 'next dev',
            start: 'next start',
          },
          dependencies: {
            '@types/node': 'latest',
            '@types/react': 'latest',
            '@types/react-dom': 'latest',
            'next': 'latest',
            'react': 'latest',
            'react-dom': 'latest',
            'typescript': 'latest',
          },
        },
        null,
        2,
      ),
    ),
    'tsconfig.json': strToU8(
      JSON.stringify(
        {
          compilerOptions: {
            allowJs: true,
            esModuleInterop: true,
            forceConsistentCasingInFileNames: true,
            isolatedModules: true,
            jsx: 'preserve',
            lib: ['dom', 'dom.iterable', 'esnext'],
            module: 'esnext',
            moduleResolution: 'bundler',
            noEmit: true,
            resolveJsonModule: true,
            skipLibCheck: true,
            strict: true,
            target: 'es5',
          },
          include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
        },
        null,
        2,
      ),
    ),
  };

  const zipped = zipSync(files);
  downloadBlob(new Blob([zipped], { type: 'application/zip' }), `${name}-nextjs.zip`);
};
