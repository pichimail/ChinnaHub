import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type FileViewerComponent from './index';

let FileViewer: typeof FileViewerComponent;

vi.mock('@/components/MediaFilePreview', () => ({
  default: () => <div data-testid="media" />,
}));

vi.mock('./NotSupport', () => ({
  default: () => <div data-testid="not-support" />,
}));

vi.mock('./Renderer/PreviewableCode', () => ({
  default: ({ fileName }: { fileName?: string }) => (
    <div data-testid="previewable-code">{fileName}</div>
  ),
}));

vi.mock('./Renderer/Code', () => ({
  default: ({ fileName }: { fileName?: string }) => <div data-testid="code">{fileName}</div>,
}));

vi.mock('./Renderer/Image', () => ({
  default: () => <div data-testid="image" />,
}));

vi.mock('./Renderer/MSDoc', () => ({
  default: () => <div data-testid="ms-doc" />,
}));

vi.mock('./Renderer/PDF', () => ({
  default: () => <div data-testid="pdf" />,
}));

const createFile = (name: string, fileType = 'text/plain') =>
  ({
    chunkCount: null,
    chunkingError: null,
    createdAt: new Date(),
    embeddingError: null,
    fileType,
    finishEmbedding: false,
    id: 'file-1',
    name,
    size: 128,
    sourceType: 'upload',
    updatedAt: new Date(),
    url: '/f/file-1',
  }) as const;

describe('FileViewer', () => {
  beforeAll(async () => {
    FileViewer = (await import('./index')).default;
  }, 30_000);

  it.each([
    ['index.html', 'text/html'],
    ['index.htm', 'text/html'],
    ['App.jsx', 'text/plain'],
    ['App.tsx', 'text/plain'],
    ['demo.app.jsx', 'text/plain'],
    ['demo.app.tsx', 'text/plain'],
    ['script.py', 'text/x-python'],
  ])('renders previewable code for %s', (name, fileType) => {
    render(<FileViewer {...createFile(name, fileType)} />);

    expect(screen.getByTestId('previewable-code')).toHaveTextContent(name);
  });

  it('renders non-previewable code through the source viewer', () => {
    render(<FileViewer {...createFile('main.go', 'text/x-go')} />);

    expect(screen.getByTestId('code')).toHaveTextContent('main.go');
  });
});
