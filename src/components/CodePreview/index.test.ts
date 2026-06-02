import { describe, expect, it } from 'vitest';

import { getCodePreviewType, isPreviewableWebCode } from './index';

describe('CodePreview helpers', () => {
  it('detects HTML files and MIME types', () => {
    expect(getCodePreviewType({ fileName: 'index.html' })).toBe('html');
    expect(getCodePreviewType({ fileName: 'page.htm' })).toBe('html');
    expect(getCodePreviewType({ language: 'text/html' })).toBe('html');
  });

  it('detects React component files', () => {
    expect(getCodePreviewType({ fileName: 'App.jsx' })).toBe('react');
    expect(getCodePreviewType({ fileName: 'App.tsx' })).toBe('react');
    expect(getCodePreviewType({ fileName: 'demo.app.jsx' })).toBe('react');
    expect(getCodePreviewType({ fileName: 'demo.app.tsx' })).toBe('react');
    expect(getCodePreviewType({ language: 'application/lobe.artifacts.react' })).toBe('react');
  });

  it('does not mark non-web code as previewable', () => {
    expect(isPreviewableWebCode({ fileName: 'script.py' })).toBe(false);
  });
});
